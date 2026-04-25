import { type FormEvent, useEffect, useState } from "react";
import { Camera, CheckCircle2, ClipboardCheck, Loader2, QrCode, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { api, type AttendanceCheckIn, type AttendanceOverview, type PagedResult } from "@/lib/api";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import { QrCameraScanner } from "@/components/admin/QrCameraScanner";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminAttendanceTab() {
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [checkIns, setCheckIns] = useState<PagedResult<AttendanceCheckIn> | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [token, setToken] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [scannerOpen, setScannerOpen] = useState(false);

  const load = async (nextPage = page, nextSearch = search) => {
    setLoading(true);
    try {
      const [nextOverview, nextCheckIns] = await Promise.all([
        api.attendance.overview(),
        api.attendance.checkIns({ page: nextPage, search: nextSearch || undefined }),
      ]);
      setOverview(nextOverview);
      setCheckIns(nextCheckIns);
      setPage(nextCheckIns.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar presenças.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCheckIn = async () => {
    if (!token.trim() && !studentNumber.trim()) {
      toast.error("Lê o QR ou informa o número de estudante.");
      return;
    }

    setChecking(true);
    try {
      const result = await api.attendance.checkIn({
        token: token.trim() || undefined,
        studentNumber: studentNumber.trim() || undefined,
      });
      toast.success(result.alreadyCheckedIn ? "Presença já estava registada." : "Check-in registado.");
      setToken("");
      setStudentNumber("");
      await load(1, search.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao registar check-in.");
    } finally {
      setChecking(false);
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(1, search.trim());
  };

  const handlePageChange = (nextPage: number) => {
    void load(nextPage, search.trim());
  };

  return (
    <div className="space-y-5">
      <QrCameraScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onRead={(value) => {
          setToken(value);
          toast.success("QR lido. Confirma o registo para concluir o check-in.");
        }}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Credenciais", value: overview?.totalCredentials ?? 0 },
          { label: "Presenças", value: overview?.totalCheckIns ?? 0 },
          { label: "Hoje", value: overview?.todayCheckIns ?? 0 },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-5 w-5 text-primary" />
            Check-in por QR ou número
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_220px_auto_160px]">
          <Input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Cole aqui o link/token lido no QR" />
          <Input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="Número estudante" />
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setScannerOpen(true)}>
            <Camera className="mr-2 h-4 w-4" />
            Ler QR
          </Button>
          <Button className="rounded-xl" onClick={() => void handleCheckIn()} disabled={checking}>
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Registar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Presenças registadas
            </CardTitle>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar presença..." />
              </div>
              <Button variant="outline" className="rounded-xl" type="submit" disabled={loading}>
                <Search className="mr-2 h-4 w-4" />
                Pesquisar
              </Button>
              <Button variant="outline" className="rounded-xl" type="button" onClick={() => void load(page, search.trim())} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudante</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Operador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5}>A carregar presenças...</TableCell></TableRow>
                ) : checkIns?.items.length ? (
                  checkIns.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-semibold">{item.studentName || `Estudante ${item.studentNumber}`}</p>
                        <p className="text-xs text-muted-foreground">{item.studentNumber}</p>
                      </TableCell>
                      <TableCell>{item.studentCourse || "Não informado"}</TableCell>
                      <TableCell>{item.eventLabel}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(item.checkedInAt)}</TableCell>
                      <TableCell>{item.checkedInByStudentNumber}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5}>Sem presenças registadas para estes filtros.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {checkIns ? (
            <AdminTablePagination
              page={checkIns.page}
              total={checkIns.total}
              totalPages={checkIns.totalPages}
              loading={loading}
              onPageChange={handlePageChange}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
