'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Loader2, X, GripVertical, GripHorizontal, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Merge, Split } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface PlanningSheetProps {
    projectId: string;
    isOwner: boolean;
    advancedMode?: boolean;
    refreshTrigger?: number;
}

export function PlanningSheet({ projectId, isOwner, advancedMode = false, refreshTrigger }: PlanningSheetProps) {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sheet, setSheet] = useState<any>(null);
    const [columns, setColumns] = useState<any[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [cells, setCells] = useState<Record<string, string>>({}); // rowId_colId -> value
    const [cellFormats, setCellFormats] = useState<Record<string, Record<string, unknown>>>({}); // rowId_colId -> format_json
    const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string } | null>(null);
    const [selectionAnchor, setSelectionAnchor] = useState<{ rowId: string; colId: string } | null>(null);
    const [merges, setMerges] = useState<Array<{ id: string; start_row_id: string; start_col_id: string; row_span: number; col_span: number }>>([]);
    const [selectionDragging, setSelectionDragging] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        loadSheetData();
    }, [projectId, refreshTrigger]);

    const loadSheetData = async () => {
        setLoading(true);
        try {
            let sheetData: any = null;

            // 1. Get or create sheet via RPC (prevents duplicate key)
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_or_create_planning_sheet', {
                    p_project_id: projectId,
                    p_created_by: profile?.id ?? null
                });

            if (!rpcError && rpcData) {
                sheetData = Array.isArray(rpcData) ? rpcData[0] : rpcData;
            }

            if (!sheetData) {
                const { data: existing } = await supabase
                    .from('planning_sheets')
                    .select('*')
                    .eq('project_id', projectId)
                    .maybeSingle();

                if (existing) {
                    sheetData = existing;
                } else {
                    const { data: newSheet, error: insertErr } = await supabase
                        .from('planning_sheets')
                        .insert({ project_id: projectId, created_by: profile?.id })
                        .select()
                        .single();
                    if (insertErr) {
                        const { data: retry } = await supabase
                            .from('planning_sheets')
                            .select('*')
                            .eq('project_id', projectId)
                            .single();
                        sheetData = retry;
                        if (!sheetData) throw insertErr;
                    } else {
                        sheetData = newSheet;

                        // Notify all project members
                        const { data: members } = await supabase
                            .from('project_members')
                            .select('user_id')
                            .eq('project_id', projectId);

                        if (members?.length) {
                            const { data: proj } = await supabase
                                .from('projects')
                                .select('name')
                                .eq('id', projectId)
                                .single();

                            const notifications = members
                                .filter(m => m.user_id !== profile?.id) // Don't notify the creator
                                .map(m => ({
                                    user_id: m.user_id,
                                    type: 'info',
                                    title: 'Nouveau Planning',
                                    message: `Un planning a été initialisé pour le projet "${proj?.name || 'Inconnu'}" par ${profile?.full_name || 'un administrateur'}.`,
                                    link: `/projets/${projectId}`
                                }));
                            if (notifications.length > 0) {
                                await supabase.from('notifications').insert(notifications);
                            }
                        }
                    }
                }
            }

            if (!sheetData) throw new Error('Could not load planning sheet');
            setSheet(sheetData);

            const { data: existingCols } = await supabase
                .from('planning_columns')
                .select('id')
                .eq('sheet_id', sheetData.id)
                .limit(1);
            if (!existingCols?.length) {
                await supabase.from('planning_columns').insert([
                    { sheet_id: sheetData.id, name: 'Tâches', order_index: 0, type: 'text' },
                    { sheet_id: sheetData.id, name: 'Statut', order_index: 1, type: 'text' },
                    { sheet_id: sheetData.id, name: 'Notes', order_index: 2, type: 'text' }
                ]);
            }

            // 2. Load columns
            const { data: cols, error: colsError } = await supabase
                .from('planning_columns')
                .select('*')
                .eq('sheet_id', sheetData.id)
                .order('order_index');

            if (colsError) throw colsError;
            setColumns(cols || []);

            // 3. Load rows
            const { data: rowData, error: rowsError } = await supabase
                .from('planning_rows')
                .select('*')
                .eq('sheet_id', sheetData.id)
                .order('order_index');

            if (rowsError) throw rowsError;
            setRows(rowData || []);

            // 4. Load cells
            const { data: cellData, error: cellsError } = await supabase
                .from('planning_cells')
                .select('*')
                .in('row_id', rowData?.map(r => r.id) || []);

            if (cellsError) throw cellsError;

            const cellMap: Record<string, string> = {};
            const formatMap: Record<string, Record<string, unknown>> = {};
            cellData?.forEach((c: any) => {
                const key = `${c.row_id}_${c.column_id}`;
                cellMap[key] = c.value_text ?? '';
                if (c.format_json && typeof c.format_json === 'object') {
                    formatMap[key] = c.format_json as Record<string, unknown>;
                }
            });
            setCells(cellMap);
            setCellFormats(formatMap);

            // 5. Load merges
            const { data: mergesData } = await supabase
                .from('planning_merges')
                .select('id, start_row_id, start_col_id, row_span, col_span')
                .eq('sheet_id', sheetData.id);
            setMerges(mergesData || []);

        } catch (error: any) {
            console.error('Error loading sheet:', error);
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleCellChange = (rowId: string, colId: string, value: string) => {
        if (!isOwner) return;
        setCells(prev => ({
            ...prev,
            [`${rowId}_${colId}`]: value
        }));
    };

    const applyFormat = (key: string, value: unknown) => {
        if (!selectedCell || !isOwner || !advancedMode) return;
        const k = `${selectedCell.rowId}_${selectedCell.colId}`;
        setCellFormats(prev => ({
            ...prev,
            [k]: { ...(prev[k] || {}), [key]: value }
        }));
    };

    const toggleFormat = (key: string) => {
        if (!selectedCell || !isOwner || !advancedMode) return;
        const k = `${selectedCell.rowId}_${selectedCell.colId}`;
        const current = cellFormats[k]?.[key];
        applyFormat(key, !Boolean(current));
    };

    const rowIdx = (rowId: string) => rows.findIndex(r => r.id === rowId);
    const colIdx = (colId: string) => columns.findIndex(c => c.id === colId);

    const getSelectionRange = (): { startRowIdx: number; startColIdx: number; endRowIdx: number; endColIdx: number } | null => {
        const anchor = selectionAnchor || selectedCell;
        if (!anchor || !selectedCell) return null;
        const sr = rowIdx(anchor.rowId);
        const sc = colIdx(anchor.colId);
        const er = rowIdx(selectedCell.rowId);
        const ec = colIdx(selectedCell.colId);
        if (sr < 0 || sc < 0 || er < 0 || ec < 0) return null;
        return {
            startRowIdx: Math.min(sr, er),
            startColIdx: Math.min(sc, ec),
            endRowIdx: Math.max(sr, er),
            endColIdx: Math.max(sc, ec),
        };
    };

    const getMergeCovering = (rowId: string, colId: string) => merges.find(m => {
        const r = rowIdx(rowId);
        const c = colIdx(colId);
        const mr = rowIdx(m.start_row_id);
        const mc = colIdx(m.start_col_id);
        return r >= mr && r < mr + m.row_span && c >= mc && c < mc + m.col_span;
    });

    const isMergeTopLeft = (rowId: string, colId: string) => merges.some(m => m.start_row_id === rowId && m.start_col_id === colId);

    const selectionOverlapsMerge = () => {
        const range = getSelectionRange();
        if (!range) return true;
        for (let r = range.startRowIdx; r <= range.endRowIdx; r++) {
            for (let c = range.startColIdx; c <= range.endColIdx; c++) {
                const merge = getMergeCovering(rows[r].id, columns[c].id);
                if (merge) return true;
            }
        }
        return false;
    };

    const handleMerge = async () => {
        if (!isOwner || !advancedMode || !sheet) return;
        const range = getSelectionRange();
        if (!range) {
            toast({ title: "Sélectionnez des cellules", description: "Glissez pour sélectionner une zone, ou Maj+clic pour étendre", variant: "destructive" });
            return;
        }
        const rowCount = range.endRowIdx - range.startRowIdx + 1;
        const colCount = range.endColIdx - range.startColIdx + 1;
        if (rowCount < 2 && colCount < 2) {
            toast({ title: "Zone trop petite", description: "Sélectionnez au moins 2 cellules (horizontalement ou verticalement)", variant: "destructive" });
            return;
        }
        if (selectionOverlapsMerge()) {
            toast({ title: "Impossible", description: "La sélection chevauche une fusion existante. Annulez d'abord la fusion.", variant: "destructive" });
            return;
        }
        try {
            const { data, error } = await supabase.from('planning_merges').insert({
                sheet_id: sheet.id,
                start_row_id: rows[range.startRowIdx].id,
                start_col_id: columns[range.startColIdx].id,
                row_span: rowCount,
                col_span: colCount,
            }).select('id, start_row_id, start_col_id, row_span, col_span').single();
            if (error) throw error;
            setMerges(prev => [...prev, data]);
            toast({ title: "Cellules fusionnées" });
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        }
    };

    const handleUnmerge = async () => {
        if (!isOwner || !advancedMode || !selectedCell) return;
        const merge = getMergeCovering(selectedCell.rowId, selectedCell.colId);
        if (!merge) {
            toast({ title: "Aucune fusion", description: "Sélectionnez une cellule fusionnée pour annuler", variant: "destructive" });
            return;
        }
        try {
            const { error } = await supabase.from('planning_merges').delete().eq('id', merge.id);
            if (error) throw error;
            setMerges(prev => prev.filter(m => m.id !== merge.id));
            toast({ title: "Fusion annulée" });
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        }
    };

    const handleCellSelect = (rowId: string, colId: string, shiftKey: boolean) => {
        if (!advancedMode) return;
        if (shiftKey && selectionAnchor) {
            setSelectedCell({ rowId, colId });
        } else {
            setSelectionAnchor({ rowId, colId });
            setSelectedCell({ rowId, colId });
        }
    };

    const handleCellMouseDown = useCallback((rowId: string, colId: string) => {
        if (!advancedMode) return;
        setSelectionAnchor({ rowId, colId });
        setSelectedCell({ rowId, colId });
        setSelectionDragging(true);
    }, [advancedMode]);

    useEffect(() => {
        if (!selectionDragging) return;
        const onMove = (e: MouseEvent) => {
            const td = (e.target as HTMLElement)?.closest?.('td[data-row-id][data-col-id]') as HTMLElement | null;
            if (td) {
                const rid = td.getAttribute('data-row-id');
                const cid = td.getAttribute('data-col-id');
                if (rid && cid) setSelectedCell({ rowId: rid, colId: cid });
            }
        };
        const onUp = () => {
            setSelectionDragging(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [selectionDragging]);

    const isCellInSelection = (rowId: string, colId: string) => {
        const range = getSelectionRange();
        if (!range) return selectedCell?.rowId === rowId && selectedCell?.colId === colId;
        const r = rowIdx(rowId);
        const c = colIdx(colId);
        return r >= range.startRowIdx && r <= range.endRowIdx && c >= range.startColIdx && c <= range.endColIdx;
    };

    const handleDragEndRow = async (event: DragEndEvent) => {
        if (!isOwner) return;
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = rows.findIndex((r) => r.id === active.id);
            const newIndex = rows.findIndex((r) => r.id === over.id);
            const newRows = arrayMove(rows, oldIndex, newIndex);
            setRows(newRows);

            // Persist order_index
            const updates = newRows.map((r, idx) => ({ id: r.id, order_index: idx, sheet_id: sheet.id }));
            await supabase.from('planning_rows').upsert(updates);
        }
    };

    const handleDragEndCol = async (event: DragEndEvent) => {
        if (!isOwner) return;
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = columns.findIndex((c) => c.id === active.id);
            const newIndex = columns.findIndex((c) => c.id === over.id);
            const newCols = arrayMove(columns, oldIndex, newIndex);
            setColumns(newCols);

            // Persist order_index
            const updates = newCols.map((c, idx) => ({ id: c.id, order_index: idx, sheet_id: sheet.id, name: c.name, type: c.type }));
            await supabase.from('planning_columns').upsert(updates);
        }
    };

    const addRow = async () => {
        if (!isOwner) return;
        try {
            const { data: newRow, error } = await supabase
                .from('planning_rows')
                .insert({ sheet_id: sheet.id, order_index: rows.length })
                .select()
                .single();

            if (error) throw error;
            setRows([...rows, newRow]);
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const addColumn = async () => {
        if (!isOwner) return;
        try {
            const { data: newCol, error } = await supabase
                .from('planning_columns')
                .insert({ sheet_id: sheet.id, name: 'Nouvelle Colonne', order_index: columns.length, type: 'text' })
                .select()
                .single();

            if (error) throw error;
            setColumns([...columns, newCol]);
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const updateColumnName = async (colId: string, newName: string) => {
        if (!isOwner) return;
        setColumns(prev => prev.map(c => c.id === colId ? { ...c, name: newName } : c));
        try {
            const { error } = await supabase
                .from('planning_columns')
                .update({ name: newName })
                .eq('id', colId);
            if (error) throw error;
        } catch (error: any) {
            console.error('Error updating column name:', error);
        }
    };

    const deleteColumn = async (colId: string, colName: string) => {
        if (!isOwner || !confirm(`Supprimer la colonne "${colName}" ?\nCela supprimera toutes les données de cette colonne.`)) return;
        try {
            const { error } = await supabase.from('planning_columns').delete().eq('id', colId);
            if (error) throw error;
            setColumns(columns.filter(c => c.id !== colId));
            // Cleanup local cells state
            const newCells = { ...cells };
            Object.keys(newCells).forEach(key => {
                if (key.endsWith(`_${colId}`)) delete newCells[key];
            });
            setCells(newCells);
            toast({ title: "Supprimé", description: `Colonne "${colName}" supprimée` });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const deleteRow = async (rowId: string) => {
        if (!isOwner || !confirm('Supprimer cette ligne ?')) return;
        try {
            const { error } = await supabase.from('planning_rows').delete().eq('id', rowId);
            if (error) throw error;
            setRows(rows.filter(r => r.id !== rowId));
            // Cleanup local cells state
            const newCells = { ...cells };
            Object.keys(newCells).forEach(key => {
                if (key.startsWith(`${rowId}_`)) delete newCells[key];
            });
            setCells(newCells);
            toast({ title: "Supprimé", description: "Ligne supprimée" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const saveChanges = async () => {
        if (!isOwner) return;
        setSaving(true);
        try {
            const allKeys = new Set([...Object.keys(cells), ...Object.keys(cellFormats)]);
            const cellEntries = Array.from(allKeys).map((key) => {
                const [row_id, column_id] = key.split('_');
                const value = cells[key];
                const fmt = cellFormats[key];
                return {
                    row_id,
                    column_id,
                    value_text: value ?? '',
                    format_json: fmt && Object.keys(fmt).length > 0 ? fmt : {}
                };
            }).filter(e => e.row_id && e.column_id);

            if (cellEntries.length === 0) {
                toast({ title: "Enregistré", description: "Aucune modification à sauvegarder." });
                setSaving(false);
                return;
            }

            // Upsert cells (need sheet context for row_id - planning_cells uses row_id from planning_rows)
            const { error } = await supabase
                .from('planning_cells')
                .upsert(cellEntries, { onConflict: 'row_id,column_id' });

            if (error) throw error;

            toast({ title: "Enregistré", description: "Les modifications ont été sauvegardées" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Tableau de planification</h3>
                    {isOwner && (
                        <div className="flex gap-2">
                            <Button onClick={addColumn} variant="outline" size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Colonne
                            </Button>
                            <Button onClick={addRow} variant="outline" size="sm">
                                <Plus className="w-4 h-4 mr-2" /> Ligne
                            </Button>
                            <Button onClick={saveChanges} disabled={saving} size="sm">
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Enregistrer
                            </Button>
                        </div>
                    )}
                </div>
                {advancedMode && isOwner && (
                    <div className="flex flex-wrap items-center gap-1 p-2 rounded-lg border bg-muted/30">
                        <Button variant="ghost" size="sm" onClick={() => toggleFormat('bold')} className={selectedCell && cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.bold ? 'bg-muted' : ''}>
                            <Bold className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleFormat('italic')} className={selectedCell && cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.italic ? 'bg-muted' : ''}>
                            <Italic className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleFormat('underline')} className={selectedCell && cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.underline ? 'bg-muted' : ''}>
                            <Underline className="w-4 h-4" />
                        </Button>
                        <span className="w-px h-6 bg-border mx-1" />
                        <select
                            className="h-8 rounded border px-2 text-sm bg-background"
                            onChange={(e) => applyFormat('fontSize', e.target.value)}
                            value={selectedCell ? String(cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.fontSize || 14) : '14'}
                            disabled={!selectedCell}
                        >
                            {[10, 12, 14, 16, 18, 20, 24].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <select
                            className="h-8 rounded border px-2 text-sm bg-background"
                            onChange={(e) => applyFormat('fontFamily', e.target.value)}
                            value={selectedCell ? String(cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.fontFamily || 'inherit') : 'inherit'}
                            disabled={!selectedCell}
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
                            disabled={!selectedCell}
                            title="Couleur du texte"
                        />
                        <input
                            type="color"
                            className="w-8 h-8 rounded border cursor-pointer p-0"
                            onChange={(e) => applyFormat('backgroundColor', e.target.value)}
                            disabled={!selectedCell}
                            title="Couleur de fond"
                        />
                        <span className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="sm" onClick={() => applyFormat('textAlign', 'left')} className={selectedCell && cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.textAlign === 'left' ? 'bg-muted' : ''}>
                            <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => applyFormat('textAlign', 'center')} className={selectedCell && cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.textAlign === 'center' ? 'bg-muted' : ''}>
                            <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => applyFormat('textAlign', 'right')} className={selectedCell && cellFormats[`${selectedCell.rowId}_${selectedCell.colId}`]?.textAlign === 'right' ? 'bg-muted' : ''}>
                            <AlignRight className="w-4 h-4" />
                        </Button>
                        <span className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="sm" onClick={handleMerge} title="Fusionner les cellules sélectionnées">
                            <Merge className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleUnmerge} title="Annuler la fusion">
                            <Split className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            <div className="border rounded-lg overflow-x-auto">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => {
                        const isRow = rows.some((r) => r.id === event.active.id);
                        if (isRow) handleDragEndRow(event);
                        else handleDragEndCol(event);
                    }}
                >
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <SortableContext
                                items={columns.map(c => c.id)}
                                strategy={horizontalListSortingStrategy}
                            >
                                <tr className="bg-muted/50 border-b">
                                    {columns.map(col => (
                                        <SortableHeader key={col.id} col={col} isOwner={isOwner} onDelete={() => deleteColumn(col.id, col.name)} onUpdateName={updateColumnName} />
                                    ))}
                                    {isOwner && <th className="w-10"></th>}
                                </tr>
                            </SortableContext>
                        </thead>
                        <tbody className="divide-y relative">
                            <SortableContext
                                items={rows.map(r => r.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length} className="p-8 text-center text-muted-foreground italic">
                                            Aucune donnée. {isOwner && "Ajoutez une ligne pour commencer."}
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map(row => (
                                        <SortableRow
                                            key={row.id}
                                            row={row}
                                            rowIdx={rows.findIndex(r => r.id === row.id)}
                                            columns={columns}
                                            cells={cells}
                                            cellFormats={cellFormats}
                                            merges={merges}
                                            isOwner={isOwner}
                                            advancedMode={advancedMode}
                                            selectedCell={selectedCell}
                                            onSelectCell={handleCellSelect}
                                            onCellMouseDown={handleCellMouseDown}
                                            isCellInSelection={isCellInSelection}
                                            getMergeCovering={getMergeCovering}
                                            isMergeTopLeft={isMergeTopLeft}
                                            handleCellChange={handleCellChange}
                                            onDelete={() => deleteRow(row.id)}
                                        />
                                    ))
                                )}
                            </SortableContext>
                        </tbody>
                    </table>
                </DndContext>
            </div>
        </div>
    );
}

// SUB-COMPONENTS FOR SORTABLE
function SortableHeader({ col, isOwner, onDelete, onUpdateName }: { col: any, isOwner: boolean, onDelete: () => void, onUpdateName: (id: string, name: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 20 : 1,
    };

    return (
        <th ref={setNodeRef} style={style} className="p-0 text-left font-medium border-r last:border-r-0 min-w-[200px] group bg-muted/30">
            <div className="flex items-center h-10">
                {isOwner && (
                    <div {...attributes} {...listeners} className="px-2 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary">
                        <GripHorizontal className="w-4 h-4" />
                    </div>
                )}
                <Input
                    value={col.name}
                    onChange={(e) => onUpdateName(col.id, e.target.value)}
                    className="border-0 rounded-none focus-visible:ring-0 h-10 bg-transparent px-3 font-bold text-slate-700 dark:text-slate-300 flex-1"
                    readOnly={!isOwner}
                />
                {isOwner && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-muted-foreground hover:text-destructive mr-1"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                )}
            </div>
        </th>
    );
}

function SortableRow({ row, rowIdx, columns, rows, cells, cellFormats, merges, isOwner, advancedMode, selectedCell, onSelectCell, onCellMouseDown, isCellInSelection, getMergeCovering, isMergeTopLeft, handleCellChange, onDelete }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    let colRendered = 0;
    return (
        <tr ref={setNodeRef} style={style} className="hover:bg-muted/20 group/row bg-background">
            {columns.map((col: any, idx: number) => {
                const merge = getMergeCovering?.(row.id, col.id);
                const covered = merge && !(merge.start_row_id === row.id && merge.start_col_id === col.id);
                if (covered) return null;

                const cellKey = `${row.id}_${col.id}`;
                const fmt = cellFormats?.[cellKey] || {};
                const isSelected = isCellInSelection?.(row.id, col.id);
                const topLeftMerge = isMergeTopLeft?.(row.id, col.id) ? merge : null;
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
                colRendered++;
                const isFirstInRow = colRendered === 1;
                return (
                    <td
                        key={col.id}
                        data-row-id={row.id}
                        data-col-id={col.id}
                        className="p-0 border-r last:border-r-0"
                        {...(topLeftMerge && { rowSpan: topLeftMerge.row_span, colSpan: topLeftMerge.col_span })}
                        onMouseDown={() => advancedMode && onCellMouseDown?.(row.id, col.id)}
                    >
                        <div className="flex items-center">
                            {isFirstInRow && isOwner && (
                                <div {...attributes} {...listeners} className="px-2 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-primary">
                                    <GripVertical className="w-4 h-4" />
                                </div>
                            )}
                            <Input
                                value={cells[cellKey] || ''}
                                onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                                onFocus={() => advancedMode && onSelectCell?.(row.id, col.id, false)}
                                onClick={(e: React.MouseEvent) => advancedMode && onSelectCell?.(row.id, col.id, e.shiftKey)}
                                readOnly={!isOwner}
                                style={advancedMode ? cellStyle : undefined}
                                className={cn(
                                    "border-0 rounded-none focus-visible:ring-1 focus-visible:ring-inset h-10 bg-transparent px-3 flex-1",
                                    isSelected && advancedMode && "ring-2 ring-primary"
                                )}
                                placeholder={isOwner ? "..." : ""}
                            />
                        </div>
                    </td>
                );
            })}
            {isOwner && (
                <td className="p-0 text-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="opacity-0 group-hover/row:opacity-100 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </td>
            )}
        </tr>
    );
}
