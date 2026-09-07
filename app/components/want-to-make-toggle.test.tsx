import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/actions", () => ({
  toggleWantToMake: vi.fn(),
}));

import { toggleWantToMake } from "@/app/lib/actions";
import { WantToMakeToggle } from "./want-to-make-toggle";

beforeEach(() => {
  vi.mocked(toggleWantToMake).mockReset();
});

describe("WantToMakeToggle", () => {
  it("reflects the initial value in aria-pressed", () => {
    render(<WantToMakeToggle recipeId="r1" initialValue />);
    expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
  });

  it("calls the action with the toggled value on click", async () => {
    const user = userEvent.setup();
    vi.mocked(toggleWantToMake).mockResolvedValue(undefined);
    render(<WantToMakeToggle recipeId="r1" initialValue={false} />);

    await user.click(screen.getByRole("button"));
    expect(toggleWantToMake).toHaveBeenCalledWith("r1", true);
  });

  it("optimistically flips while the action is pending", async () => {
    const user = userEvent.setup();
    vi.mocked(toggleWantToMake).mockReturnValue(new Promise(() => {}));
    render(<WantToMakeToggle recipeId="r1" initialValue={false} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});
