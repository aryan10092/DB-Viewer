import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import axios from "axios";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./components/ui/table";

function parseConnectionString(connStr) {
  // Basic Postgres connection string parser
  try {
    const url = new URL(connStr.replace(/^postgres(ql)?:/, 'http:'));
    return {
      host: url.hostname,
      port: url.port || "5432",
      user: url.username,
      password: url.password,
      database: url.pathname.replace(/^\//, ""),
      ssl: url.search.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
      family:4
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [form, setForm] = useState({
    host: "",
    port: "5432",
    user: "",
    password: "",
    database: "",
  });
  const [connStr, setConnStr] = useState("");
  const [useConnStr, setUseConnStr] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [loadingTable, setLoadingTable] = useState(false);
  const [sql, setSql] = useState("");
  const [sqlResult, setSqlResult] = useState({ columns: [], rows: [] });
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlError, setSqlError] = useState("");

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    setError("");
    setSuccess(false);
    setTables([]);
    setSelectedTable(null);
    setTableData({ columns: [], rows: [] });
    let payload = form;
    if (useConnStr) {
      const parsed = parseConnectionString(connStr);
      if (!parsed) {
        setError("Invalid connection string");
        setConnecting(false);
        return;
      }
      payload = parsed;
    }
    try {
      const res = await axios.post(`${apiUrl}/api/test-connection`, payload);
      if (res.data.success) {
        setSuccess(true);
        // Fetch tables
        const tablesRes = await axios.post(`${apiUrl}/api/list-tables`, payload);
        if (tablesRes.data.success) {
          setTables(tablesRes.data.tables);
        } else {
          setError(tablesRes.data.error || "Failed to fetch tables");
        }
      } else {
        setError(res.data.error || "Unknown error");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setConnecting(false);
    }
  };

  const getPayload = () => {
    if (useConnStr) {
      const parsed = parseConnectionString(connStr);
      return parsed || {};
    }
    return form;
  };

  const handleSelectTable = async (table) => {
    setSelectedTable(table);
    setLoadingTable(true);
    setTableData({ columns: [], rows: [] });
    try {
      const query = `SELECT * FROM "${table.table_schema}"."${table.table_name}" LIMIT 100;`;
      const res = await axios.post(`${apiUrl}/api/query`, { ...getPayload(), query });
      if (res.data.success) {
        setTableData({ columns: res.data.columns, rows: res.data.rows });
      } else {
        setError(res.data.error || "Failed to fetch table data");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoadingTable(false);
    }
  };

  const handleSqlRun = async (e) => {
    e.preventDefault();
    setSqlLoading(true);
    setSqlError("");
    setSqlResult({ columns: [], rows: [] });
    try {
      const res = await axios.post(`${apiUrl}/api/query`, { ...getPayload(), query: sql });
      if (res.data.success) {
        setSqlResult({ columns: res.data.columns, rows: res.data.rows });
        if (selectedTable && sql.toLowerCase().includes(selectedTable.table_name.toLowerCase())) {
          await handleSelectTable(selectedTable);
        }
      } else {
        setSqlError(res.data.error || "Query failed");
      }
    } catch (err) {
      setSqlError(err.response?.data?.error || err.message);
    } finally {
      setSqlLoading(false);
    }
  };

  if (!success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle>Connect to Postgres Database</CardTitle>
          </CardHeader>
          <form onSubmit={handleConnect}>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="useConnStr"
                  checked={useConnStr}
                  onChange={() => setUseConnStr((v) => !v)}
                  className="accent-primary"
                />
                <label htmlFor="useConnStr" className="text-sm cursor-pointer select-none">Connect using connection string</label>
              </div>
              {useConnStr ? (
                <Input
                  name="connStr"
                  placeholder="postgresql://user:pass@host:port/db?sslmode=require"
                  value={connStr}
                  onChange={e => setConnStr(e.target.value)}
                  required
                />
              ) : (
                <>
                  <Input
                    name="host"
                    placeholder="Host (e.g. localhost)"
                    value={form.host}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    name="port"
                    placeholder="Port (default: 5432)"
                    value={form.port}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    name="user"
                    placeholder="User"
                    value={form.user}
                    onChange={handleChange}
                    required
                  />
                  <Input
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange}
                  />
                  <Input
                    name="database"
                    placeholder="Database name"
                    value={form.database}
                    onChange={handleChange}
                    required
                  />
                </>
              )}
              {error && <div className="text-destructive text-sm">{error}</div>}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full mt-4" disabled={connecting}>
                {connecting ? "Connecting..." : "Connect"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-5xl mb-4 shadow-lg mx-auto">
        <CardHeader>
          <CardTitle>Tables in {form.database}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 justify-cente">
            {tables.map((table) => {
              const isSelected = selectedTable && selectedTable.table_name === table.table_name && selectedTable.table_schema === table.table_schema;
              return (
                <Button
                  key={table.table_schema + "." + table.table_name}
                  variant={ "default" }
                  onClick={() => handleSelectTable(table)}
                  className="truncate max-w-xs px-4 py-2 font-semibold text-base transition-colors align-items-center"
                  title={`${table.table_schema}.${table.table_name}`}
                >
                  {table.table_schema}.{table.table_name}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {selectedTable && (
        <div className="flex justify-center w-full">
          <Card className="w-full max-w-5xl shadow-lg mb-4">
            <CardHeader>
              <CardTitle>Data: {selectedTable.table_schema}.{selectedTable.table_name}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTable ? (
                <div>Loading...</div>
              ) : tableData.columns.length > 0 ? (
                <div className="overflow-x-auto max-w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {tableData.columns.map((col) => (
                          <TableHead key={col} className="whitespace-nowrap max-w-xs truncate" title={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.rows.map((row, i) => (
                        <TableRow key={i}>
                          {tableData.columns.map((col) => (
                            <TableCell key={col} className="whitespace-nowrap max-w-xs truncate" title={String(row[col])}>{String(row[col])}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div>No data found.</div>
              )}
              {error && <div className="text-destructive text-sm mt-2">{error}</div>}
            </CardContent>
          </Card>
        </div>
      )}
      <Card className="w-full max-w-5xl mt-4 shadow-lg">
        <CardHeader>
          <CardTitle>Run SQL Query</CardTitle>
        </CardHeader>
        <form onSubmit={handleSqlRun}>
          <CardContent className="space-y-2">
            <Input
              as="textarea"
              className="font-mono min-h-[60px]"
              value={sql}
              onChange={e => setSql(e.target.value)}
              placeholder="SELECT * FROM ..."
              required
            />
            <Button type="submit" disabled={sqlLoading}>
              {sqlLoading ? "Running..." : "Run"}
            </Button>
            {sqlError && <div className="text-destructive text-sm">{sqlError}</div>}
          </CardContent>
        </form>
        <CardContent>
          {sqlResult.columns.length > 0 && (
            <div className="overflow-x-auto mt-2 max-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    {sqlResult.columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap max-w-xs truncate" title={col}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sqlResult.rows.map((row, i) => (
                    <TableRow key={i}>
                      {sqlResult.columns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap max-w-xs truncate" title={String(row[col])}>{String(row[col])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
