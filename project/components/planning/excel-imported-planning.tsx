'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Merge, Split, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface ExcelImportedPlanningProps {
  importId: string | null;
  canEdit?: boolean;
}

type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
};

export function ExcelImportedPlanning({ importId, canEdit = false }: ExcelImportedPlanningProps) {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<any | null>(null);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [cellFormats, setCellFormats] = useState<Record<string, CellFormat>>({});
  const [merges, setMerges] = useState<Array<{ id: string; start_r: number; start_c: number; row_span: number; col_span: number }>>([]);
  const [mergeTopLeft, setMergeTopLeft] = useState<Record<string, { rowSpan: number; colSpan: number }>>({});
  const [covered, setCovered] = useState<Record<string, boolean>>({});
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [selectionAnchor, setSelectionAnchor] = useState<{ r: number; c: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!importId) {
      setMeta(null);
      setCells({});
      setCellFormats({});
      setMerges([]);
      setMergeTopLeft({});
      setCovered({});
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const { data: imports, error: impErr } = await supabase
          .from('excel_imports')
          .select('id, file_name, sheet_name, row_count, col_count')
          .eq('id', importId)
          .single();
        if (impErr) throw impErr;
        setMeta(imports);

        const { data: cellRows, error: cellErr } = await supabase
          .from('excel_import_cells')
          .select('r, c, value_text, style_json')
          .eq('import_id', importId);
        if (cellErr) throw cellErr;
        const cellMap: Record<string, string> = {};
        const formatMap: Record<string, CellFormat> = {};
        (cellRows || []).forEach((c: any) => {
          cellMap[`${c.r}_${c.c}`] = c.value_text ?? '';
          if (c.style_json && typeof c.style_json === 'object') {
            formatMap[`${c.r}_${c.c}`] = c.style_json as CellFormat;
          }
        });
        setCells(cellMap);
        setCellFormats(formatMap);

        const { data: mergeRows, error: mergeErr } = await supabase
          .from('excel_import_merges')
          .select('id, start_r, start_c, row_span, col_span')
          .eq('import_id', importId);
        if (mergeErr) throw mergeErr;
        setMerges(mergeRows || []);
        recomputeMergeMaps(mergeRows || []);
      } catch (e) {
        console.error('Error loading excel import view', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [importId]);

  const recomputeMergeMaps = (mergeRows: any[]) => {
    const topLeft: Record<string, { rowSpan: number; colSpan: number }> = {};
    const coveredMap: Record<string, boolean> = {};
    mergeRows.forEach((m: any) => {
      const key = `${m.start_r}_${m.start_c}`;
      topLeft[key] = { rowSpan: m.row_span, colSpan: m.col_span };
      for (let dr = 0; dr < m.row_span; dr++) {
        for (let dc = 0; dc < m.col_span; dc++) {
          if (dr === 0 && dc === 0) continue;
          coveredMap[`${m.start_r + dr}_${m.start_c + dc}`] = true;
        }
      }
    });
    setMergeTopLeft(topLeft);
    setCovered(coveredMap);
  };

  const handleCellChange = (r: number, c: number, value: string) => {
    if (!canEdit) return;
    setCells(prev => ({
      ...prev,
      [`${r}_${c}`]: value,
    }));
  };

  const currentCellKey = selectedCell ? `${selectedCell.r}_${selectedCell.c}` : null;

  const applyFormat = (key: keyof CellFormat, value: unknown) => {
    if (!canEdit || !currentCellKey) return;
    setCellFormats(prev => ({
      ...prev,
      [currentCellKey]: { ...(prev[currentCellKey] || {}), [key]: value } as CellFormat,
    }));
  };

  const toggleFormat = (key: keyof CellFormat) => {
    if (!canEdit || !currentCellKey) return;
    const current = cellFormats[currentCellKey]?.[key] as boolean | undefined;
    applyFormat(key, !Boolean(current));
  };

  const getSelectionRange = () => {
    const anchor = selectionAnchor || selectedCell;
    if (!anchor || !selectedCell) return null;
    const sr = Math.min(anchor.r, selectedCell.r);
    const sc = Math.min(anchor.c, selectedCell.c);
    const er = Math.max(anchor.r, selectedCell.r);
    const ec = Math.max(anchor.c, selectedCell.c);
    return { startRow: sr, startCol: sc, endRow: er, endCol: ec };
  };

  const isCellInSelection = (r: number, c: number) => {
    const range = getSelectionRange();
    if (!range) return selectedCell?.r === r && selectedCell?.c === c;
    return r >= range.startRow && r <= range.endRow && c >= range.startCol && c <= range.endCol;
  };

  const getMergeCovering = (r: number, c: number) =>
    merges.find(m => r >= m.start_r && r < m.start_r + m.row_span && c >= m.start_c && c < m.start_c + m.col_span);

  const isMergeTopLeft = (r: number, c: number) =>
    merges.some(m => m.start_r === r && m.start_c === c);

  const selectionOverlapsMerge = () => {
    const range = getSelectionRange();
    if (!range) return true;
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const merge = getMergeCovering(r, c);
        if (merge) return true;
      }
    }
    return false;
  };

  const handleMerge = async () => {
    if (!canEdit || !meta) return;
    const range = getSelectionRange();
    if (!range) {
      toast({ title: "Sélectionnez des cellules", description: "Glissez pour sélectionner une zone, ou Maj+clic pour étendre", variant: "destructive" });
      return;
    }
    const rowCount = range.endRow - range.startRow + 1;
    const colCount = range.endCol - range.startCol + 1;
    if (rowCount < 2 && colCount < 2) {
      toast({ title: "Zone trop petite", description: "Sélectionnez au moins 2 cellules (horizontalement ou verticalement)", variant: "destructive" });
      return;
    }
    if (selectionOverlapsMerge()) {
      toast({ title: "Impossible", description: "La sélection chevauche une fusion existante. Annulez d'abord la fusion.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('excel_import_merges')
        .insert({
          import_id: importId,
          start_r: range.startRow,
          start_c: range.startCol,
          row_span: rowCount,
          col_span: colCount,
        })
        .select('id, import_id, start_r, start_c, row_span, col_span')
        .single();
      if (error) throw error;
      const next = [...merges, data];
      setMerges(next);
      recomputeMergeMaps(next);
      toast({ title: "Cellules fusionnées" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const handleUnmerge = async () => {
    if (!canEdit || !selectedCell) return;
    const merge = getMergeCovering(selectedCell.r, selectedCell.c);
    if (!merge) {
      toast({ title: "Aucune fusion", description: "Sélectionnez une cellule fusionnée pour annuler", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from('excel_import_merges').delete().eq('id', merge.id);
      if (error) throw error;
      const next = merges.filter(m => m.id !== merge.id);
      setMerges(next);
      recomputeMergeMaps(next);
      toast({ title: "Fusion annulée" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const addRow = async () => {
    if (!canEdit || !meta) return;
    try {
      const newCount = (meta.row_count as number) + 1;
      const { error } = await supabase
        .from('excel_imports')
        .update({ row_count: newCount })
        .eq('id', meta.id);
      if (error) throw error;
      setMeta({ ...meta, row_count: newCount });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const addColumn = async () => {
    if (!canEdit || !meta) return;
    try {
      const newCount = (meta.col_count as number) + 1;
      const { error } = await supabase
        .from('excel_imports')
        .update({ col_count: newCount })
        .eq('id', meta.id);
      if (error) throw error;
      setMeta({ ...meta, col_count: newCount });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  const saveChanges = useCallback(async () => {
    if (!canEdit || !importId) return;
    setSaving(true);
    try {
      const allKeys = new Set([...Object.keys(cells), ...Object.keys(cellFormats)]);
      const entries = Array.from(allKeys).map((key) => {
        const [rStr, cStr] = key.split('_');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        if (Number.isNaN(r) || Number.isNaN(c)) return null;
        const value = cells[key] ?? '';
        const fmt = cellFormats[key];
        return {
          import_id: importId,
          r,
          c,
          value_text: value,
          style_json: fmt && Object.keys(fmt).length > 0 ? fmt : {},
        };
      }).filter(Boolean) as Array<{ import_id: string; r: number; c: number; value_text: string; style_json: CellFormat | {} }>;

      if (!entries.length) {
        toast({ title: "Enregistré", description: "Aucune modification à sauvegarder." });
        setSaving(false);
        return;
      }

      const CHUNK = 500;
      for (let i = 0; i < entries.length; i += CHUNK) {
        const chunk = entries.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('excel_import_cells')
          .upsert(chunk, { onConflict: 'import_id,r,c' });
        if (error) throw error;
      }

      toast({ title: "Enregistré", description: "Les modifications ont été sauvegardées." });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [canEdit, importId, cells, cellFormats, toast]);

  if (!importId) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardContent className="px-0 py-4 text-sm text-muted-foreground">
          Aucune importation sélectionnée.
        </CardContent>
      </Card>
    );
  }

  if (loading || !meta) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const rows = meta.row_count as number;
  const cols = meta.col_count as number;

  const updateSheetName = async (newName: string) => {
    if (!canEdit || !meta) return;
    setMeta({ ...meta, sheet_name: newName });
    try {
      const { error } = await supabase
        .from('excel_imports')
        .update({ sheet_name: newName })
        .eq('id', meta.id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating sheet name:', err);
    }
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Import Excel : {meta.file_name} — </span>
            {canEdit ? (
              <Input
                value={meta.sheet_name || ''}
                onChange={(e) => updateSheetName(e.target.value)}
                className="h-8 border-none focus-visible:ring-1 bg-muted/20 font-bold inline-block w-auto"
              />
            ) : (
              <span>{meta.sheet_name}</span>
            )}
          </CardTitle>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={addColumn} variant="outline" size="sm">
                + Colonne
              </Button>
              <Button onClick={addRow} variant="outline" size="sm">
                + Ligne
              </Button>
              <Button
                onClick={saveChanges}
                size="sm"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Enregistrer
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      {canEdit && (
        <CardContent className="px-0 pb-4">
          <div className="flex flex-wrap items-center gap-1 p-2 rounded-lg border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFormat('bold')}
              className={currentCellKey && cellFormats[currentCellKey]?.bold ? 'bg-muted' : ''}
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFormat('italic')}
              className={currentCellKey && cellFormats[currentCellKey]?.italic ? 'bg-muted' : ''}
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFormat('underline')}
              className={currentCellKey && cellFormats[currentCellKey]?.underline ? 'bg-muted' : ''}
            >
              <Underline className="w-4 h-4" />
            </Button>
            <span className="w-px h-6 bg-border mx-1" />
            <select
              className="h-8 rounded border px-2 text-sm bg-background"
              onChange={(e) => applyFormat('fontSize', Number(e.target.value))}
              value={
                currentCellKey
                  ? String(cellFormats[currentCellKey]?.fontSize || 14)
                  : '14'
              }
              disabled={!currentCellKey}
            >
              {[10, 12, 14, 16, 18, 20, 24].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded border px-2 text-sm bg-background"
              onChange={(e) => applyFormat('fontFamily', e.target.value)}
              value={
                currentCellKey
                  ? String(cellFormats[currentCellKey]?.fontFamily || 'inherit')
                  : 'inherit'
              }
              disabled={!currentCellKey}
            >
              <option value="inherit">Police</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>
            <input
              type="color"
              className="w-8 h-8 rounded border cursor-pointer p-0"
              onChange={(e) => applyFormat('color', e.target.value)}
              disabled={!currentCellKey}
              title="Couleur du texte"
            />
            <input
              type="color"
              className="w-8 h-8 rounded border cursor-pointer p-0"
              onChange={(e) => applyFormat('backgroundColor', e.target.value)}
              disabled={!currentCellKey}
              title="Couleur de fond"
            />
            <span className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat('textAlign', 'left')}
              className={
                currentCellKey && cellFormats[currentCellKey]?.textAlign === 'left'
                  ? 'bg-muted'
                  : ''
              }
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat('textAlign', 'center')}
              className={
                currentCellKey && cellFormats[currentCellKey]?.textAlign === 'center'
                  ? 'bg-muted'
                  : ''
              }
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyFormat('textAlign', 'right')}
              className={
                currentCellKey && cellFormats[currentCellKey]?.textAlign === 'right'
                  ? 'bg-muted'
                  : ''
              }
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            <span className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMerge}
              title="Fusionner les cellules sélectionnées"
            >
              <Merge className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnmerge}
              title="Annuler la fusion"
            >
              <Split className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      )}
      <CardContent className="px-0 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => {
                  const key = `${r}_${c}`;
                  if (covered[key]) return null;
                  const merge = mergeTopLeft[key];
                  const value = cells[key] ?? '';
                  const fmt = cellFormats[key] || {};
                  const cellStyle: React.CSSProperties = {
                    fontFamily: (fmt.fontFamily as string) || undefined,
                    fontSize: fmt.fontSize ? `${fmt.fontSize}px` : undefined,
                    fontWeight: fmt.bold ? 'bold' : undefined,
                    fontStyle: fmt.italic ? 'italic' : undefined,
                    textDecoration: fmt.underline ? 'underline' : undefined,
                    color: (fmt.color as string) || undefined,
                    backgroundColor: (fmt.backgroundColor as string) || undefined,
                    textAlign: (fmt.textAlign as 'left' | 'center' | 'right') || undefined,
                  };
                  const isSelected = isCellInSelection(r, c);
                  return (
                    <td
                      key={c}
                      className={`border px-0 py-0 align-top ${isSelected && canEdit ? 'ring-2 ring-primary' : ''}`}
                      {...(merge && { rowSpan: merge.rowSpan, colSpan: merge.colSpan })}
                      onMouseDown={() => {
                        if (!canEdit) return;
                        setSelectionAnchor({ r, c });
                        setSelectedCell({ r, c });
                      }}
                      onMouseEnter={(e) => {
                        if (!canEdit || !(e.buttons & 1)) return;
                        setSelectedCell({ r, c });
                      }}
                    >
                      {canEdit ? (
                        <Input
                          value={value}
                          onChange={(e) => handleCellChange(r, c, e.target.value)}
                          style={cellStyle}
                          className="border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset h-9 bg-transparent px-2"
                          onFocus={() => setSelectedCell({ r, c })}
                        />
                      ) : (
                        <div className="px-2 py-1" style={cellStyle}>
                          {value}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

