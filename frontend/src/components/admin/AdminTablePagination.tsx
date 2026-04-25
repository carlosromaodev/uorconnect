import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminTablePaginationProps = {
  page: number;
  total: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

export function AdminTablePagination({
  page,
  total,
  totalPages,
  loading = false,
  onPageChange,
}: AdminTablePaginationProps) {
  const currentPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        {total} registo{total === 1 ? "" : "s"} · Página {currentPage} de {Math.max(totalPages, 1)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={loading || currentPage <= 1}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={loading || currentPage >= Math.max(totalPages, 1)}
        >
          Próxima
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
