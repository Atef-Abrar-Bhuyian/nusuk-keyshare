import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDoneKeys } from "@/hooks/use-done-keys";

// The "done" mark must be personal to the device: stored locally, never shared,
// so other users can still use a key someone marked done.
describe("useDoneKeys", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists a done mark to localStorage", () => {
    const { result } = renderHook(() => useDoneKeys());

    act(() => result.current.toggleDone("key-1"));

    expect([...result.current.doneIds]).toEqual(["key-1"]);
    expect(JSON.parse(window.localStorage.getItem("keys_done_ids") ?? "")).toEqual(["key-1"]);
  });

  it("marks and unmarks the same key by toggling twice", () => {
    const { result } = renderHook(() => useDoneKeys());

    act(() => result.current.toggleDone("key-1"));
    act(() => result.current.toggleDone("key-1"));

    expect(result.current.doneIds.size).toBe(0);
  });

  it("loads done marks saved by this device on a fresh mount", () => {
    window.localStorage.setItem("keys_done_ids", JSON.stringify(["key-2"]));

    const { result } = renderHook(() => useDoneKeys());

    expect(result.current.doneIds.has("key-2")).toBe(true);
  });

  it("clears every done mark for this device", () => {
    window.localStorage.setItem("keys_done_ids", JSON.stringify(["key-1", "key-2"]));

    const { result } = renderHook(() => useDoneKeys());
    act(() => result.current.clearAllDone());

    expect(result.current.doneIds.size).toBe(0);
    expect(window.localStorage.getItem("keys_done_ids")).toBeNull();
  });
});
