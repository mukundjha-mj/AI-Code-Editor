import path from "node:path";
import ts from "typescript";
import type {
  ExportReference,
  ImportReference,
  ParsedFileMetadata,
  RepositorySymbol,
  SupportedExtension,
} from "./repository.types";

const ENTRY_POINT_FILES = new Set([
  "index.ts",
  "index.js",
  "main.ts",
  "main.js",
  "main.tsx",
  "main.jsx",
  "app.tsx",
  "app.jsx",
  "server.ts",
  "server.js",
]);

const REACT_ROUTE_BUILDERS = new Set(["createBrowserRouter", "createHashRouter", "createMemoryRouter"]);

const hasExportModifier = (node: ts.Node) =>
  ts.canHaveModifiers(node)
    ? ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
    : false;

const hasDefaultModifier = (node: ts.Node) =>
  ts.canHaveModifiers(node)
    ? ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false
    : false;

const hasJsxDescendant = (node: ts.Node): boolean => {
  let found = false;
  const visitor = (current: ts.Node) => {
    if (
      ts.isJsxElement(current) ||
      ts.isJsxSelfClosingElement(current) ||
      ts.isJsxFragment(current)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visitor);
  };
  ts.forEachChild(node, visitor);
  return found;
};

const isPascalCase = (name: string) => /^[A-Z][A-Za-z0-9]*$/.test(name);

const normalizeRoutePath = (route: string): string => route.trim();

const extractRoutePathFromJsxAttributes = (attributes: ts.JsxAttributes): string | null => {
  for (const attribute of attributes.properties) {
    if (
      !ts.isJsxAttribute(attribute) ||
      !ts.isIdentifier(attribute.name) ||
      attribute.name.text !== "path" ||
      !attribute.initializer
    ) {
      continue;
    }

    const initializer = attribute.initializer;
    if (ts.isStringLiteral(initializer)) {
      return normalizeRoutePath(initializer.text);
    }

    if (
      ts.isJsxExpression(initializer) &&
      initializer.expression &&
      ts.isStringLiteral(initializer.expression)
    ) {
      return normalizeRoutePath(initializer.expression.text);
    }
  }

  return null;
};

const extractStringProperty = (objectNode: ts.ObjectLiteralExpression, propertyName: string) => {
  for (const property of objectNode.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      continue;
    }
    if (property.name.text !== propertyName) {
      continue;
    }
    if (ts.isStringLiteral(property.initializer)) {
      return property.initializer.text;
    }
  }

  return null;
};

const collectRoutesFromObjectArray = (node: ts.ArrayLiteralExpression, routeAccumulator: Set<string>) => {
  for (const element of node.elements) {
    if (!ts.isObjectLiteralExpression(element)) {
      continue;
    }

    const pathValue = extractStringProperty(element, "path");
    if (pathValue) {
      routeAccumulator.add(normalizeRoutePath(pathValue));
    }

    const childrenInitializer = element.properties
      .filter(ts.isPropertyAssignment)
      .find(
        (property): property is ts.PropertyAssignment =>
          ts.isIdentifier(property.name) && property.name.text === "children",
      )?.initializer;

    if (childrenInitializer && ts.isArrayLiteralExpression(childrenInitializer)) {
      collectRoutesFromObjectArray(childrenInitializer, routeAccumulator);
    }
  }
};

const scriptKindByExtension = (extension: SupportedExtension): ts.ScriptKind => {
  switch (extension) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".ts":
      return ts.ScriptKind.TS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".json":
      return ts.ScriptKind.JSON;
    default:
      return ts.ScriptKind.JS;
  }
};

export class AstParser {
  parse(filePath: string, extension: SupportedExtension, content: string): ParsedFileMetadata {
    if (extension === ".json") {
      return this.parseJson(filePath, content);
    }

    return this.parseScript(filePath, extension, content);
  }

  private parseJson(filePath: string, content: string): ParsedFileMetadata {
    const symbols: RepositorySymbol[] = [];

    try {
      const parsedValue: unknown = JSON.parse(content);
      if (parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)) {
        const objectValue = parsedValue as Record<string, unknown>;
        for (const key of Object.keys(objectValue)) {
          symbols.push({
            id: `${filePath}:variable:${key}`,
            name: key,
            type: "variable",
            sourceFile: filePath,
            isExported: true,
            relationships: [],
          });
        }
      }
    } catch {
      // Invalid JSON files should still be tracked as repository files.
    }

    return {
      symbols,
      imports: [],
      exports: [],
      componentDefinitions: [],
      componentUsages: [],
      discoveredRoutes: [],
      isEntryPoint: false,
    };
  }

  private parseScript(filePath: string, extension: SupportedExtension, content: string): ParsedFileMetadata {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKindByExtension(extension),
    );

    const imports: ImportReference[] = [];
    const exports: ExportReference[] = [];
    const symbolsByKey = new Map<string, RepositorySymbol>();
    const explicitExports = new Set<string>();
    const componentDefinitions = new Set<string>();
    const componentUsages = new Set<string>();
    const discoveredRoutes = new Set<string>();

    const upsertSymbol = (symbol: RepositorySymbol) => {
      symbolsByKey.set(`${symbol.type}:${symbol.name}`, symbol);
    };

    const registerDeclarationSymbol = (
      name: string,
      type: RepositorySymbol["type"],
      isExported: boolean,
      relationships: string[] = [],
    ) => {
      upsertSymbol({
        id: `${filePath}:${type}:${name}`,
        name,
        type,
        sourceFile: filePath,
        isExported,
        relationships,
      });
    };

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const importSpecifiers: string[] = [];
        const importClause = node.importClause;
        if (importClause?.name) {
          importSpecifiers.push(importClause.name.text);
        }
        if (importClause?.namedBindings) {
          if (ts.isNamespaceImport(importClause.namedBindings)) {
            importSpecifiers.push(`* as ${importClause.namedBindings.name.text}`);
          } else {
            for (const specifier of importClause.namedBindings.elements) {
              importSpecifiers.push(specifier.name.text);
            }
          }
        }
        imports.push({
          source: node.moduleSpecifier.text,
          specifiers: importSpecifiers,
          isTypeOnly: importClause?.isTypeOnly ?? false,
        });
      }

      if (ts.isExportDeclaration(node)) {
        const source =
          node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
            ? node.moduleSpecifier.text
            : undefined;
        const exportClause = node.exportClause;
        if (exportClause && ts.isNamedExports(exportClause)) {
          for (const element of exportClause.elements) {
            const exportName = element.name.text;
            explicitExports.add(exportName);
            exports.push({
              name: exportName,
              isDefault: false,
              source,
            });
          }
        }
      }

      if (ts.isExportAssignment(node)) {
        exports.push({
          name: "default",
          isDefault: true,
        });
      }

      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.text;
        const exported = hasExportModifier(node);
        const isComponent = isPascalCase(name) && hasJsxDescendant(node);
        if (isComponent) {
          componentDefinitions.add(name);
          registerDeclarationSymbol(name, "component", exported);
        } else {
          registerDeclarationSymbol(name, "function", exported);
        }
        if (exported || hasDefaultModifier(node)) {
          explicitExports.add(name);
          exports.push({ name, isDefault: hasDefaultModifier(node) });
        }
      }

      if (ts.isClassDeclaration(node) && node.name) {
        const name = node.name.text;
        const exported = hasExportModifier(node);
        registerDeclarationSymbol(name, "class", exported);
        if (exported || hasDefaultModifier(node)) {
          explicitExports.add(name);
          exports.push({ name, isDefault: hasDefaultModifier(node) });
        }
      }

      if (ts.isInterfaceDeclaration(node)) {
        const name = node.name.text;
        const exported = hasExportModifier(node);
        registerDeclarationSymbol(name, "interface", exported);
        if (exported || hasDefaultModifier(node)) {
          explicitExports.add(name);
          exports.push({ name, isDefault: hasDefaultModifier(node) });
        }
      }

      if (ts.isTypeAliasDeclaration(node)) {
        const name = node.name.text;
        const exported = hasExportModifier(node);
        registerDeclarationSymbol(name, "type", exported);
        if (exported || hasDefaultModifier(node)) {
          explicitExports.add(name);
          exports.push({ name, isDefault: hasDefaultModifier(node) });
        }
      }

      if (ts.isVariableStatement(node)) {
        const exported = hasExportModifier(node);
        for (const declaration of node.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) {
            continue;
          }
          const variableName = declaration.name.text;
          const initializer = declaration.initializer;
          let isFunctionComponentInitializer = false;
          if (initializer) {
            isFunctionComponentInitializer =
              ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
          }
          const isComponentCandidate =
            isPascalCase(variableName) &&
            isFunctionComponentInitializer &&
            initializer !== undefined &&
            hasJsxDescendant(initializer);

          if (isComponentCandidate) {
            componentDefinitions.add(variableName);
            registerDeclarationSymbol(variableName, "component", exported);
          } else {
            registerDeclarationSymbol(variableName, "variable", exported);
          }

          if (exported) {
            explicitExports.add(variableName);
            exports.push({ name: variableName, isDefault: false });
          }
        }
      }

      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        if (ts.isIdentifier(node.tagName)) {
          const tagName = node.tagName.text;
          if (isPascalCase(tagName)) {
            componentUsages.add(tagName);
          }

          if (tagName === "Route") {
            const routePath = extractRoutePathFromJsxAttributes(node.attributes);
            if (routePath) {
              discoveredRoutes.add(routePath);
            }
          }
        }
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        REACT_ROUTE_BUILDERS.has(node.expression.text)
      ) {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isArrayLiteralExpression(firstArg)) {
          collectRoutesFromObjectArray(firstArg, discoveredRoutes);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    for (const [key, symbol] of symbolsByKey.entries()) {
      const exported = symbol.isExported || explicitExports.has(symbol.name);
      if (exported !== symbol.isExported) {
        symbolsByKey.set(key, { ...symbol, isExported: exported });
      }
    }

    const basename = path.basename(filePath).toLowerCase();
    const isEntryPoint =
      ENTRY_POINT_FILES.has(basename) ||
      discoveredRoutes.size > 0 ||
      basename === "routes.tsx" ||
      basename === "router.tsx";

    return {
      symbols: [...symbolsByKey.values()],
      imports,
      exports,
      componentDefinitions: [...componentDefinitions],
      componentUsages: [...componentUsages],
      discoveredRoutes: [...discoveredRoutes],
      isEntryPoint,
    };
  }
}
