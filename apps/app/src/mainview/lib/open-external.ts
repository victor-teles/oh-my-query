import { openExternal as ipcOpenExternal } from "@/lib/ipc";

export async function openExternal(url: string): Promise<void> {
  await ipcOpenExternal(url);
}
