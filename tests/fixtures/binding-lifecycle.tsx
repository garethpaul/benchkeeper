import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useWebMCP } from '../../src/webmcp';

// Isolated lifecycle fixture; this entry is never imported by the product.
declare global {
  interface Window {
    bindingFixture: { mount: (strict: boolean) => void; unmount: () => void };
  }
}

const root = createRoot(document.getElementById('root')!);
function Binding() {
  const status = useWebMCP();
  return (
    <output id="binding-status">
      {status.kind}:{status.count}
    </output>
  );
}
window.bindingFixture = {
  mount(strict) {
    root.render(
      strict ? (
        <StrictMode>
          <Binding />
        </StrictMode>
      ) : (
        <Binding />
      )
    );
  },
  unmount() {
    root.render(null);
  }
};
