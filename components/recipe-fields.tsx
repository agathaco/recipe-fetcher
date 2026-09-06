import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// The field layout shared by the add and edit forms. Both are plain <form>s
// wired to a Server Action, so this is just markup with default values.
type Defaults = {
  title?: string;
  sourceUrl?: string;
  ingredients?: string;
  steps?: string;
  notes?: string;
  tags?: string;
  wantToMake?: boolean;
};

export function RecipeFields({ defaults = {} }: { defaults?: Defaults }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={defaults.title} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ingredients">Ingredients</Label>
          <Textarea
            id="ingredients"
            name="ingredients"
            rows={12}
            placeholder="One per line"
            defaultValue={defaults.ingredients}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="steps">Steps</Label>
          <Textarea
            id="steps"
            name="steps"
            rows={12}
            defaultValue={defaults.steps}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            name="tags"
            placeholder="dessert, quick, vegetarian"
            defaultValue={defaults.tags}
          />
          <p className="text-muted-foreground text-xs">Comma-separated</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceUrl">Source URL</Label>
          <Input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            placeholder="https://"
            defaultValue={defaults.sourceUrl}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="wantToMake" name="wantToMake" defaultChecked={defaults.wantToMake} />
        <Label htmlFor="wantToMake" className="font-normal">
          Want to make
        </Label>
      </div>
    </div>
  );
}
