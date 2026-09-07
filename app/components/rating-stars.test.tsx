import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/actions", () => ({
  setRating: vi.fn(),
}));

import { setRating } from "@/app/lib/actions";
import { RatingStars } from "./rating-stars";

beforeEach(() => {
  vi.mocked(setRating).mockReset();
  vi.mocked(setRating).mockResolvedValue(undefined);
});

describe("RatingStars", () => {
  it("renders five rating buttons", () => {
    render(<RatingStars recipeId="r1" initialValue={0} />);
    expect(screen.getAllByRole("button", { name: /Rate \d out of 5/ })).toHaveLength(5);
  });

  it("sets the rating to the clicked star", async () => {
    const user = userEvent.setup();
    render(<RatingStars recipeId="r1" initialValue={0} />);
    await user.click(screen.getByRole("button", { name: "Rate 4 out of 5" }));
    expect(setRating).toHaveBeenCalledWith("r1", 4);
  });

  it("clears the rating when the current value is clicked again", async () => {
    const user = userEvent.setup();
    render(<RatingStars recipeId="r1" initialValue={3} />);
    await user.click(screen.getByRole("button", { name: "Rate 3 out of 5" }));
    expect(setRating).toHaveBeenCalledWith("r1", 0);
  });
});
