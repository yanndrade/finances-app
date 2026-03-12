import { useState, useRef, type FormEvent } from "react";
import { Settings2, Search, X, Plus, Tag } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import type { CategoryOption } from "../../lib/categories";

type CategoryManagerDialogProps = {
  categories: CategoryOption[];
  onCreateCategory: (label: string) => boolean;
  onRemoveCategory: (categoryId: string) => void;
};

export function CategoryManagerDialog({
  categories,
  onCreateCategory,
  onRemoveCategory,
}: CategoryManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = newLabel.trim();
    if (!trimmed) return;

    const wasCreated = onCreateCategory(trimmed);
    if (!wasCreated) {
      setFeedback({ kind: "error", message: "Já existe uma categoria com esse nome." });
      return;
    }

    setNewLabel("");
    setFeedback({ kind: "success", message: `"${trimmed}" adicionada.` });
    inputRef.current?.focus();
  }

  const filteredCategories = searchQuery.trim()
    ? categories.filter((c) =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : categories;

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) {
        setNewLabel("");
        setFeedback(null);
        setSearchQuery("");
      }
    }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
          aria-label="Gerenciar categorias"
        >
          <Settings2 className="h-3 w-3" aria-hidden="true" />
          Gerenciar
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Categorias
          </DialogTitle>
          <DialogDescription>
            Crie e remova categorias personalizadas para classificar seus lançamentos.
          </DialogDescription>
        </DialogHeader>

        {/* Add new category */}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2"
          aria-label="Adicionar categoria"
        >
          <Input
            ref={inputRef}
            id="category-manager-input"
            aria-label="Nova categoria"
            placeholder="Nome da categoria..."
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
              setFeedback(null);
            }}
            className="h-9"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={!newLabel.trim()}
            aria-label="Adicionar"
            className="h-9 px-3 shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        {feedback ? (
          <p
            role="status"
            className={`text-xs ${feedback.kind === "error" ? "text-rose-600" : "text-emerald-600"}`}
          >
            {feedback.message}
          </p>
        ) : null}

        {/* Search — only show when there's enough to search */}
        {categories.length >= 6 ? (
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              aria-label="Filtrar categorias"
              placeholder="Filtrar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        ) : null}

        {/* Category list */}
        <div
          aria-label="Lista de categorias"
          className="max-h-60 overflow-y-auto -mx-1 px-1"
          role="list"
        >
          {filteredCategories.length > 0 ? (
            <ul className="space-y-1">
              {filteredCategories.map((category) => (
                <li
                  key={category.value}
                  className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 group"
                  role="listitem"
                >
                  <span className="truncate">{category.label}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCategory(category.value)}
                    className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label={`Remover ${category.label}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              {searchQuery ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma categoria encontrada para "{searchQuery}".
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma categoria personalizada ainda.
                  <br />
                  Crie uma usando o campo acima.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
