import { WorkspaceProvider, WorkspaceShell } from "./features/workspace";

function App() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}

export default App;
