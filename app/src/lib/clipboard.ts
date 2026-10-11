/**
 * Copy text to the clipboard, saying whether it worked. One place, because both the result screen
 * and Today offer to copy the day's grid.
 *
 * It can fail for reasons that are nobody's fault — an insecure context, a browser that wants a
 * user gesture it did not see, a locked-down profile — so the caller is expected to show the text
 * instead of an error when this returns false.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
