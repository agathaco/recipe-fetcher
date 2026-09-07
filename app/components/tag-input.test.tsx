import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TagInput } from "./tag-input";

function hiddenTagValues() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="tag"]'),
  ).map((el) => el.value);
}

describe("TagInput", () => {
  it("renders default tags as removable pills and hidden inputs", () => {
    render(<TagInput defaultValue={["dessert", "quick"]} allTags={["dessert", "quick", "baking"]} />);
    expect(hiddenTagValues()).toEqual(["dessert", "quick"]);
    expect(screen.getByRole("button", { name: "Remove dessert" })).toBeInTheDocument();
  });

  it("filters the dropdown as you type and adds the picked tag", async () => {
    const user = userEvent.setup();
    render(<TagInput defaultValue={[]} allTags={["dessert", "dinner", "quick"]} />);

    const input = screen.getByRole("textbox", { name: "Add tags" });
    await user.type(input, "din");

    expect(screen.queryByRole("button", { name: "quick" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "dinner" }));

    expect(hiddenTagValues()).toEqual(["dinner"]);
    expect(input).toHaveValue("");
  });

  it("offers a Create option for a new tag and lowercases it", async () => {
    const user = userEvent.setup();
    render(<TagInput defaultValue={[]} allTags={["dessert"]} />);

    await user.type(screen.getByRole("textbox", { name: "Add tags" }), "BRUNCH");
    await user.click(screen.getByRole("button", { name: /Create/ }));

    expect(hiddenTagValues()).toEqual(["brunch"]);
  });

  it("removes a pill via its X button", async () => {
    const user = userEvent.setup();
    render(<TagInput defaultValue={["dessert", "quick"]} allTags={["dessert", "quick"]} />);

    await user.click(screen.getByRole("button", { name: "Remove dessert" }));
    expect(hiddenTagValues()).toEqual(["quick"]);
  });

  it("removes the last tag on Backspace when the input is empty", async () => {
    const user = userEvent.setup();
    render(<TagInput defaultValue={["a", "b"]} allTags={[]} />);

    await user.click(screen.getByRole("textbox", { name: "Add tags" }));
    await user.keyboard("{Backspace}");
    expect(hiddenTagValues()).toEqual(["a"]);
  });

  it("does not add a tag that is already selected", async () => {
    const user = userEvent.setup();
    render(<TagInput defaultValue={["dessert"]} allTags={["dessert", "quick"]} />);

    // "dessert" should not be an option since it's already selected
    await user.click(screen.getByRole("textbox", { name: "Add tags" }));
    expect(screen.queryByRole("button", { name: "dessert" })).not.toBeInTheDocument();
  });
});
