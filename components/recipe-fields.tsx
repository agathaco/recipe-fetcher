import { TagInput } from "@/app/components/tag-input";
import { RowsEditor } from "@/components/rows-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// The field layout shared by the add and edit forms. Both are plain <form>s
// wired to a Server Action, so this is just markup with default values.
// `ingredients` / `steps` come in as newline-separated text (that's what the DB
// stores and what the URL-import flow passes); they're split into rows here.
type Defaults = {
  title?: string;
  sourceUrl?: string;
  imageUrl?: string;
  ingredients?: string;
  steps?: string;
  notes?: string;
  tags?: string[];
  wantToMake?: boolean;
};

function toRows(text: string | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function RecipeFields({
  defaults = {},
  allTags = [],
}: {
  defaults?: Defaults;
  allTags?: string[];
}) {
  return (
    <div className="space-y-6">
      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Recipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="e.g. Miso caramel banana bread"
              defaultValue={defaults.title}
            />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <TagInput defaultValue={defaults.tags ?? []} allTags={allTags} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="wantToMake" name="wantToMake" defaultChecked={defaults.wantToMake} />
            <Label htmlFor="wantToMake" className="font-normal">
              Want to make
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Ingredients</CardTitle>
        </CardHeader>
        <CardContent>
          <RowsEditor
            name="ingredient"
            addLabel="Add ingredient"
            placeholder="e.g. 200g plain flour"
            defaultValues={toRows(defaults.ingredients)}
          />
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <RowsEditor
            name="step"
            addLabel="Add step"
            placeholder="e.g. Preheat the oven to 180C fan"
            defaultValues={toRows(defaults.steps)}
            ordered
            multiline
          />
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Notes and links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Anything worth remembering next time"
              defaultValue={defaults.notes}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
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
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                type="url"
                placeholder="https://"
                defaultValue={defaults.imageUrl}
              />
            </div>
          </div>
          {defaults.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external preview only
            <img
              src={defaults.imageUrl}
              alt=""
              className="size-28 rounded-md object-cover"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
