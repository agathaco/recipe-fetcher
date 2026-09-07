import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RecipeForm } from "./recipe-form";
import type { FormState } from "@/app/lib/actions";

describe("RecipeForm", () => {
  it("shows the error the action returns and keeps the form on screen", async () => {
    const action = async (): Promise<FormState> => ({
      error: "Couldn't reach the database. Give it a moment and try again.",
    });
    const user = userEvent.setup();

    render(<RecipeForm action={action} allTags={[]} submitLabel="Save recipe" />);
    // Title is a required field; fill it so the browser lets the form submit.
    await user.type(screen.getByLabelText("Title"), "Test loaf");
    await user.click(screen.getByRole("button", { name: "Save recipe" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the database/i);
    // The fields are still there, not replaced by an error screen.
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("shows no error before submit", () => {
    const action = async (): Promise<FormState> => ({});
    render(<RecipeForm action={action} allTags={[]} submitLabel="Save recipe" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
