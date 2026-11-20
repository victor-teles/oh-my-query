export type BlurResponse = "ignore" | "dismiss" | "hide";

interface BlurState {
  visible: boolean;
  rendererReady: boolean;
  modal: boolean;
}

// An open system panel's blur never dismisses; before the renderer listens, hide directly.
export const blurResponse = ({
  visible,
  rendererReady,
  modal,
}: BlurState): BlurResponse => {
  if (!visible || modal) {
    return "ignore";
  }
  return rendererReady ? "dismiss" : "hide";
};
