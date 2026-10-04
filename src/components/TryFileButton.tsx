import { FileJson } from 'lucide-react';
import { useRef } from 'react';

interface Props {
  /** Checks a definition file and opens a virtual copy of the keyboard it describes. */
  onTryFile: (file: File) => void;
}

/** The "Try a definition file" button: asks for a .json file and hands it on. */
export function TryFileButton({ onTryFile }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
        <FileJson size={16} aria-hidden /> Try a definition file
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear the input so picking the same file again fires a change.
          event.target.value = '';
          if (file) onTryFile(file);
        }}
      />
    </>
  );
}
