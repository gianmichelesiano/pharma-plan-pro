import { useState, useCallback } from "react";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
} | null;

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(null);

  const confirm = useCallback((opts: Omit<NonNullable<ConfirmState>, "onConfirm">) => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...opts,
        onConfirm: () => { setState(null); resolve(true); },
      });
    });
  }, []);

  const cancel = useCallback(() => { setState(null); }, []);

  return { confirmState: state, confirm, cancel };
}
