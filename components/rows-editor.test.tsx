import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RowsEditor } from "./rows-editor";

function inputs(name: string) {
  return screen
    .getAllByRole("textbox")
    .filter((el) => el.getAttribute("name") === name);
}

describe("RowsEditor", () => {
  it("renders one empty row when there are no defaults", () => {
    render(<RowsEditor name="ingredient" addLabel="Add ingredient" placeholder="e.g. flour" />);
    expect(inputs("ingredient")).toHaveLength(1);
  });

  it("renders one row per default value", () => {
    render(
      <RowsEditor
        name="ingredient"
        addLabel="Add ingredient"
        placeholder="x"
        defaultValues={["200g flour", "2 eggs", "pinch of salt"]}
      />,
    );
    const rows = inputs("ingredient");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveValue("2 eggs");
  });

  it("adds a row on the Add button", async () => {
    const user = userEvent.setup();
    render(<RowsEditor name="step" addLabel="Add step" placeholder="x" defaultValues={["one"]} />);
    await user.click(screen.getByRole("button", { name: "Add step" }));
    expect(inputs("step")).toHaveLength(2);
  });

  it("removes a row, but never the last one", async () => {
    const user = userEvent.setup();
    render(
      <RowsEditor
        name="ingredient"
        addLabel="Add ingredient"
        placeholder="x"
        defaultValues={["a", "b"]}
      />,
    );
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[0]);
    expect(inputs("ingredient")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(inputs("ingredient")).toHaveLength(1);
  });
});
