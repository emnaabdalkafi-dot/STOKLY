import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../../../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import echo from '../../../../services/echo';
import styles from '../Gestions.module.css';
import layoutStyles from '../../../../components/layout/layout.module.css';
import * as XLSX from 'xlsx';
import {
    ArticleFormModal,
    ArticleDetailsModal,
    ManageSettingsModal,
    ImportExcelWizard,
    BulkAddCategoryModal,
    BulkAddEntrepotModal,
    ExportChoiceModal,
    DeleteArticleModal
} from './articleModals';
import { formatCompactNumber, formatCurrency, getCurrencySymbol } from '../../../../utils/formatters';

const StockActifs: React.FC = () => {
    const navigate = useNavigate();
    const currency = getCurrencySymbol();

    const [articles, setArticles] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const [entrepots, setEntrepots] = useState<any[]>([]);
    const [inventaires, setInventaires] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // filtres
    const [search, setSearch] = useState('');
    const [etatFilter, setEtatFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [entrepotFilter, setEntrepotFilter] = useState('');
    const [inventaireFilter, setInventaireFilter] = useState('');

    // Modals & States
    const [modalType, setModalType] = useState<'add_article' | 'details_article' | 'manage_categories' | 'manage_entrepots' | 'import_article' | 'add_to_category' | 'add_to_entrepot' | 'delete_article' | 'export_choice' | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<any>(null);
    const [excelData, setExcelData] = useState<any[] | null>(null);

    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const loadData = useCallback((silent = false) => {
        if (!silent) setLoading(true);
        Promise.all([
            api.get(`/stock/articles`),
            api.get(`/stock/articles/stats`),
            api.get(`/stock/categories`),
            api.get(`/stock/entrepots`),
            api.get(`/inventaires`)
        ]).then(([resArt, resStats, resCat, resEnt, resInv]) => {
            setArticles(resArt.data.data);
            setStats(resStats.data.data);
            setCategories(resCat.data.data);
            setEntrepots(resEnt.data.data);
            setInventaires(resInv.data.data);
        }).catch(console.error).finally(() => {
            if (!silent) setLoading(false);
        });
    }, []);

    useEffect(() => {
        const hasToken = localStorage.getItem('token');
        if (!hasToken) { navigate('/'); return; }
        loadData();
    }, [loadData]);

    // WebSocket listener — runs only once on mount
    useEffect(() => {
        const channel = echo.private('admin');

        channel.listen('.scan.enregistre', () => {
            // A scan only changes counts in the inventory, theoretical stock doesn't change until validation.
            // Just refresh stats.
            api.get(`/stock/stats`).then(res => setStats(res.data.data)).catch(console.error);
        });

        channel.listen('.inventaire.status.updated', () => {
            // Inventory closed or changed status -> stock might be adjusted, so refresh articles and stats
            Promise.all([
                api.get(`/stock/articles`),
                api.get(`/stock/stats`),
                api.get(`/inventaires`)
            ]).then(([resArt, resStats, resInv]) => {
                setArticles(resArt.data.data);
                setStats(resStats.data.data);
                setInventaires(resInv.data.data);
            }).catch(console.error);
        });

        return () => {
            channel.stopListening('.scan.enregistre');
            channel.stopListening('.inventaire.status.updated');
            echo.leave('admin');
        };
    }, []); // empty deps = mount/unmount only

    // Auto-open details if action=details is in URL
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const action = searchParams.get('action');
        const artId = searchParams.get('id_article');

        if (action === 'details' && artId && articles.length > 0) {
            const article = articles.find(a => String(a.id_article) === String(artId));
            if (article) {
                setSelectedArticle(article);
                setModalType('details_article');

                // Clean up URL
                searchParams.delete('action');
                searchParams.delete('id_article');
                setSearchParams(searchParams);
            }
        }
    }, [searchParams, articles]);

    // Sync selected article with list updates
    useEffect(() => {
        if (selectedArticle) {
            const updated = articles.find(art => art.id_article === selectedArticle.id_article);
            if (updated) setSelectedArticle(updated);
        }
    }, [articles]);

    const generateExportRows = () => {
        const rows: any[] = [];

        filteredArticles.forEach(a => {
            const commonData = {
                "Code Barres": a.code_barres,
                "Nom": a.nom,
                "Prix": a.prix,
                "Catégories": a.categories?.map((c: any) => c.nom).join(', '),
            };

            if (a.entrepots && a.entrepots.length > 0) {
                a.entrepots.forEach((e: any) => {
                    let qteComptee: any = 0;
                    let ecart: any = 0;
                    const qteTheorique = e.pivot?.quantite || 0;

                    if (inventaireFilter) {
                        const ligne = a.lignes_inventaire?.find((l: any) => l.id_inventaire == inventaireFilter && l.id_entrepot == e.id_entrepot);
                        if (ligne) {
                            qteComptee = ligne.quantite_comptee;
                            ecart = ligne.ecart;
                        } else {
                            qteComptee = "Non scanné";
                            ecart = "-";
                        }
                    }

                    rows.push({
                        ...commonData,
                        "Entrepôt": e.nom,
                        "Qté Totale": qteTheorique,
                        ...(inventaireFilter ? { "Qté Comptée": qteComptee, "Écart": ecart } : {})
                    });
                });
            } else {
                let qteComptee: any = 0;
                let ecart: any = 0;
                const qteTheorique = a.quantite_total || 0;

                if (inventaireFilter) {
                    const ligne = a.lignes_inventaire?.find((l: any) => l.id_inventaire == inventaireFilter);
                    if (ligne) {
                        qteComptee = ligne.quantite_comptee;
                        ecart = qteComptee - qteTheorique;
                    } else {
                        qteComptee = "Non scanné";
                        ecart = "-";
                    }
                }

                rows.push({
                    ...commonData,
                    "Entrepôt": "",
                    "Qté Totale": qteTheorique,
                    ...(inventaireFilter ? { "Qté Comptée": qteComptee, "Écart": ecart } : {})
                });
            }

        });
        return rows;
    };

    const handleExportExcel = () => {
        const rows = generateExportRows();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Articles");
        XLSX.writeFile(workbook, "StockActifs.xlsx");
    };

    const handleExportCSV = () => {
        const rows = generateExportRows();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);

        // Add UTF-8 Byte Order Mark (BOM) to support accents correctly in Excel
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "StockActifs.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws);
            setExcelData(data);
            setModalType('import_article');
            e.target.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const [generalError, setGeneralError] = useState<string | null>(null);

    const confirmImportArticles = async (transformedData: any[]) => {
        setLoading(true);
        setGeneralError(null);
        try {
            const res = await api.post(`/stock/articles/import`, { articles: transformedData });
            if (res.data.success) {
                loadData(true);
                setModalType(null);
                setExcelData(null);
            }
            else setGeneralError("Erreur lors de l'importation");
        } catch (err: any) {
            let errorMsg = err.response?.data?.message || "Erreur réseau ou serveur";
            if (errorMsg.includes('SQLSTATE') || errorMsg.includes('SQL:')) {
                errorMsg = "Erreur lors de l'importation. Vérifiez vos données.";
            }
            setGeneralError(errorMsg);
        }
        finally { setLoading(false); }
    };

    const saveArticleFromModal = async (form: any) => {
        const url = selectedArticle ? `/stock/articles/${selectedArticle.id_article}` : `/stock/articles`;
        const method = selectedArticle ? 'put' : 'post';
        await api[method](url, form);
        loadData(true);
    };

    const deleteArticle = () => {
        if (!selectedArticle) return;
        setLoading(true);
        api.delete(`/stock/articles/${selectedArticle.id_article}`)
            .then(() => {
                loadData(true);
                setModalType(null);
                setSelectedArticle(null);
            })
            .catch(err => setGeneralError(err.response?.data?.message || "Erreur de suppression"))
            .finally(() => setLoading(false));
    };

    const acceptArticle = async () => {
        if (!selectedArticle) return;
        setLoading(true);
        try {
            await api.put(`/inventaires/accept-article/${selectedArticle.id_article}`);
            loadData(true);
            setModalType(null);
            setSelectedArticle(null);
        } catch (err: any) {
            alert(err.response?.data?.message || "Erreur lors de l'acceptation");
        } finally {
            setLoading(false);
        }
    };

    const bulkDeleteArticles = async () => {
        if (!window.confirm(`Supprimer ${selectedIds.length} article(s) sélectionné(s) ?`)) return;
        try {
            await api.post(`/stock/articles/bulk-delete`, { ids: selectedIds });
            setSelectedIds([]);
            loadData(true);
        } catch (err) { console.error(err); }
    };

    const attachCategoriesAPI = async (ids: number[], categories: number[]) => {
        try {
            await api.post(`/stock/articles/attach-categories`, { ids, categories });
            setSelectedIds([]);
            loadData(true);
        } catch (err) { console.error(err); }
    };

    const attachEntrepotsAPI = async (ids: number[], entrepots: any[]) => {
        try {
            await api.post(`/stock/articles/attach-entrepots`, { ids, entrepots });
            setSelectedIds([]);
            loadData(true);
        } catch (err) { console.error(err); }
    };

    const saveSetting = (type: 'categories' | 'entrepots', formPayload: any) => {
        const { id, ...data } = formPayload;
        const url = id ? `/stock/${type}/${id}` : `/stock/${type}`;
        const method = id ? 'put' : 'post';
        api[method](url, data).then(() => loadData(true)).catch(console.error);
    };

    const deleteSetting = (type: 'categories' | 'entrepots', id: number) => {
        api.delete(`/stock/${type}/${id}`).then(() => loadData(true)).catch(console.error);
    };

    const deleteAllSettings = (type: 'categories' | 'entrepots') => {
        api.delete(`/stock/${type}/delete-all`).then(() => loadData(true)).catch(console.error);
    };

    const filteredArticles = useMemo(() => {
        return articles.filter(a => {
if (
  search &&
  !(a.nom ?? '').toLowerCase().includes(search.toLowerCase()) &&
  !(a.code_barres ?? '').toLowerCase().includes(search.toLowerCase())
) {
  return false;
}            if (etatFilter && a.etat !== etatFilter) return false;
            if (categoryFilter && !a.categories.find((c: any) => String(c.id_category) === String(categoryFilter))) return false;
            if (entrepotFilter && !a.entrepots.find((e: any) => String(e.id_entrepot) === String(entrepotFilter))) return false;
            if (inventaireFilter && !a.lignes_inventaire?.some((l: any) => String(l.id_inventaire) === String(inventaireFilter))) return false;
            return true;
        });
    }, [articles, search, etatFilter, categoryFilter, entrepotFilter, inventaireFilter]);

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredArticles.length) setSelectedIds([]);
        else setSelectedIds(filteredArticles.map(a => a.id_article));
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    return (
        <main className={styles.dashboardMain}>
            <ArticleFormModal
                isOpen={modalType === 'add_article'}
                onClose={() => setModalType(null)}
                onSubmit={saveArticleFromModal}
                selectedArticle={null}
                categories={categories}
                entrepots={entrepots}
                onReloadSettings={loadData}
            />
            <ArticleDetailsModal
                isOpen={modalType === 'details_article'}
                onClose={() => setModalType(null)}
                article={selectedArticle}
                categories={categories}
                entrepots={entrepots}
                onUpdate={saveArticleFromModal}
                onReloadSettings={loadData}
                onReject={() => setModalType('delete_article')}
                onAccept={acceptArticle}
            />
            <ManageSettingsModal
                isOpen={modalType === 'manage_categories'} onClose={() => setModalType(null)}
                type="categories" items={categories}
                onSave={(data: any) => saveSetting('categories', data)}
                onDelete={(id: number) => deleteSetting('categories', id)}
                onDeleteAll={() => deleteAllSettings('categories')}
            />
            <ManageSettingsModal
                isOpen={modalType === 'manage_entrepots'} onClose={() => setModalType(null)}
                type="entrepots" items={entrepots}
                onSave={(data: any) => saveSetting('entrepots', data)}
                onDelete={(id: number) => deleteSetting('entrepots', id)}
                onDeleteAll={() => deleteAllSettings('entrepots')}
            />
            <ImportExcelWizard
                isOpen={modalType === 'import_article'}
                onClose={() => { setModalType(null); setExcelData(null); setGeneralError(null); }}
                data={excelData || []}
                onConfirmImport={confirmImportArticles}
                generalError={generalError}
            />

            <BulkAddCategoryModal
                isOpen={modalType === 'add_to_category'}
                onClose={() => setModalType(null)}
                selectedIds={selectedIds}
                categories={categories}
                onConfirm={(cats) => attachCategoriesAPI(selectedIds, cats)}
            />

            <BulkAddEntrepotModal
                isOpen={modalType === 'add_to_entrepot'}
                onClose={() => setModalType(null)}
                selectedIds={selectedIds}
                entrepots={entrepots}
                onConfirm={(data) => attachEntrepotsAPI(selectedIds, data)}
            />
            <ExportChoiceModal
                isOpen={modalType === 'export_choice'}
                onClose={() => setModalType(null)}
                filteredArticlesCount={filteredArticles.length}
                onExportExcel={handleExportExcel}
                onExportCSV={handleExportCSV}
            />

            <DeleteArticleModal
                isOpen={modalType === 'delete_article' && selectedArticle !== null}
                onClose={() => { setModalType(null); setSelectedArticle(null); }}
                articleName={selectedArticle?.nom || ''}
                onDelete={deleteArticle}
                loading={loading}
                generalError={generalError}
            />

            <div className={layoutStyles.overviewGrid}>
                <div className={layoutStyles.statCard}>
                    <div className={layoutStyles.cardIcon}><i className="bi bi-box-seam" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>Total articles / Valeur</p>
                        <p className={layoutStyles.cardValue} title={stats?.total_articles || 0}>{stats ? formatCompactNumber(stats.total_articles) : <span className={layoutStyles.loadingDots}></span>} <span className={styles.cardSubValue} title={stats?.valeur_totale_stock}>({stats ? formatCurrency(stats.valeur_totale_stock, currency, true) : <span className={layoutStyles.loadingDots}></span>})</span></p>
                    </div>
                </div>
                <div className={layoutStyles.statCard}>
                    <div className={layoutStyles.cardIcon}><i className="bi bi-calculator" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>Écart Global (Qté)</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {stats ? (
                                <>
                                    <span className={styles.ecartPositive} title={stats?.ecart_positif}>+{formatCompactNumber(stats.ecart_positif || 0)}</span>/
                                    <span className={styles.ecartNegative} title={stats?.ecart_negatif}>{formatCompactNumber(stats.ecart_negatif || 0)}</span>
                                </>
                            ) : (
                                <span className={layoutStyles.loadingDots}></span>
                            )}
                        </div>
                    </div>
                </div>
                <div className={layoutStyles.statCard}>
                    <div className={`${layoutStyles.cardIcon} ${layoutStyles.cardIconGold}`}><i className="bi bi-check-all" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>Articles Inventoriés</p>
                        <p className={layoutStyles.cardValue}>{stats ? stats.pourcentage_inventories : <span className={layoutStyles.loadingDots}></span>}%</p>
                    </div>
                </div>
                <div className={layoutStyles.statCard}>
                    <div className={layoutStyles.cardIcon}><i className="bi bi-question-circle-fill" /></div>
                    <div className={styles.dashboardCardInfo}>
                        <p className={layoutStyles.dashboardCardTitle}>Articles Inconnus</p>
                        <p className={layoutStyles.cardValue}>{stats ? formatCompactNumber(stats.total_articles_inconnus) : <span className={layoutStyles.loadingDots}></span>}</p>
                    </div>
                </div>
            </div>

            <section className={`${styles.dashboardPanel} ${styles.dashboardPanelLarge}`}>
                <div className={styles.dashboardPanelHeader}>
                    <h3>Stock / Articles ({formatCompactNumber(filteredArticles.length)})</h3>
                    <div className={styles.dashboardPanelActions}>
                        <div className={styles.search}>
                            <i className="bi bi-search" />
                            <input type="text" placeholder="Recherche nom/code..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
                        </div>
                        <input type="file" id="import-excel" className={styles.hidden} accept=".xlsx, .xls" onChange={handleImportExcel} />
                        <button className={styles.ActionButton} onClick={() => document.getElementById('import-excel')?.click()}>
                            <i className="bi bi-download" /> Import
                        </button>
                        <button className={styles.ActionButton} onClick={() => setModalType('export_choice')}>
                            <i className="bi bi-upload" /> Export
                        </button>
                        <button className={styles.ActionButton} onClick={() => {
                            setSelectedArticle(null);
                            setModalType('add_article');
                        }}>
                            <i className="bi bi-plus-lg" /> Ajouter un article
                        </button>
                    </div>
                </div>

                <div className={styles.filterStrip}>
                    <select className={styles.filterSelect} value={etatFilter} onChange={e => setEtatFilter(e.target.value)}>
                        <option value="">Tous les états</option>
                        <option value="connu">Connu</option>
                        <option value="inconnu">Inconnu</option>
                    </select>
                        <select className={styles.filterSelect} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                            <option value="">Toutes catégories ({formatCompactNumber(categories.length)})</option>
                            {categories.map(c => <option title={c.nom} key={c.id_category} value={c.id_category}>{c.nom.length > 15 ? c.nom.substring(0, 15) + '...' : c.nom}</option>)}
                        </select>
                        <button className={styles.ActionButton} onClick={() => setModalType('manage_categories')}><i className="bi bi-gear" /></button>
                
                
                        <select className={styles.filterSelect} value={entrepotFilter} onChange={e => setEntrepotFilter(e.target.value)}>
                            <option value="">Tous les entrepôts ({formatCompactNumber(entrepots.length)})</option>
                            {entrepots.map(e => <option title={e.nom} key={e.id_entrepot} value={e.id_entrepot}>{e.nom.length > 15 ? e.nom.substring(0, 15) + '...' : e.nom}</option>)}
                        </select>
                        <button className={styles.ActionButton} onClick={() => setModalType('manage_entrepots')}><i className="bi bi-gear" /></button>
                 
                    <select className={styles.filterSelect} value={inventaireFilter} onChange={e => setInventaireFilter(e.target.value)}>
                        <option value="">Sélectionner un inventaire</option>
                        {inventaires.map(inv => <option key={inv.id_inventaire} value={inv.id_inventaire}>{inv.titre || inv.site || '—'}</option>)}
                    </select>
                </div>

                {selectedIds.length > 0 && (
                    <div className={styles.bulkActionBar}>
                        <p ><i className="bi bi-check2-circle" /> {selectedIds.length} article{selectedIds.length >1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}</p>
                        <div >
                            <button className={styles.DeleteBtn} onClick={bulkDeleteArticles}>
                                <i className="bi bi-trash" /> Supprimer
                            </button>
                            <button className={styles.ActionButton} onClick={() => setModalType('add_to_entrepot')}>
                                <i className="bi bi-plus" /> Entrepôt
                            </button>
                            <button className={styles.ActionButton} onClick={() => setModalType('add_to_category')}>
                                <i className="bi bi-plus" /> Catégorie
                            </button>
                            <button className={styles.ActionButton} onClick={() => setSelectedIds([])}>Annuler</button>
                        </div>
                    </div>
                )}

                <div className={styles.dashboardTableWrap }>
                    <table className={styles.dashboardTable}>
                        <thead>
                            <tr>
                                <th><input type="checkbox" className={styles.checkbox}
                                    checked={filteredArticles.length > 0 && selectedIds.length === filteredArticles.length}
                                    onChange={toggleSelectAll} /></th>
                                <th><i className="bi bi-qr-code-scan"></i> Code-barres</th>
                                <th><i className="bi bi-tag-fill"></i> Nom</th>
                                <th><i className="bi bi-currency-dollar"></i> Prix</th>
                                <th><i className="bi bi-grid-fill"></i> Catégories</th>
                                <th><i className="bi bi-house-gear-fill"></i> Entrepôts</th>
                                <th><i className="bi bi-calculator"></i> Qté Totale</th>
                                {inventaireFilter && <th><i className="bi bi-check2-square"></i> Qté Comptée</th>}
                                {inventaireFilter && <th><i className="bi bi-plus-slash-minus"></i> Écart</th>}
                                <th></th>
                            </tr>
                        </thead>
                        {loading ? (
                            <tbody>
                                <tr >
                                    {Array.from({ length: 8 }).map((_, index) => (
                                        <td key={index} >
                                            <span className={layoutStyles.loadingDots}></span>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>) : filteredArticles.length === 0 ? (
                                <tbody><tr><td colSpan={10} className={styles.tableEmptyMsg}>Aucun article trouvé</td></tr></tbody>
                            ) : (
                            <tbody>
                                {filteredArticles.map((item: any) => {
                                    let qteComptee: any = null;
                                    let ecart: any = null;
                                    let qteTheorequeLocale = 0;

                                    if (entrepotFilter) {
                                        const e = item.entrepots?.find((ee: any) => String(ee.id_entrepot) === String(entrepotFilter));
                                        qteTheorequeLocale = e?.pivot?.quantite || 0;
                                    } else {
                                        qteTheorequeLocale = (item.entrepots && item.entrepots.length > 0)
                                            ? item.entrepots.reduce((sum: number, val: any) => sum + (val.pivot?.quantite || 0), 0)
                                            : (item.quantite_total || 0);
                                    }

                                    if (inventaireFilter) {
                                        const l = item.lignes_inventaire?.find((lign: any) => String(lign.id_inventaire) === String(inventaireFilter));
                                        if (l && l.quantite_comptee !== null) {
                                            qteComptee = l.quantite_comptee;
                                            const theorique = l.quantite_theorique !== undefined ? Number(l.quantite_theorique) : Number(qteTheorequeLocale);
                                            if (Number(l.quantite_comptee) === 0 || Number(l.quantite_comptee) === theorique) {
                                                ecart = 0;
                                            } else {
                                                ecart = l.ecart;
                                            }
                                        }
                                        else {
                                            qteComptee = 'Non scanné';
                                            ecart = '-';
                                        }
                                    }
                                    const numericEcart = Number(ecart ?? 0);
                                    const ecartClass = ecart === '-' ? '' : (numericEcart === 0 ? styles.ecartZero : (numericEcart > 0 ? styles.ecartPositive : styles.ecartNegative));

                                    return (
                                        <tr key={item.id_article}>
                                            <td>
                                                <input type="checkbox" className={styles.checkbox}
                                                    checked={selectedIds.includes(item.id_article)}
                                                    onChange={() => toggleSelect(item.id_article)} />
                                            </td>
                                            <td><strong>{item.code_barres}</strong></td>
                                            <td title={item.nom}>{item.nom?.length > 15 ? item.nom.substring(0, 20) + '...' : item.nom}</td>
                                            <td title={item.prix}>{formatCurrency(item.prix, currency, true)}</td>
                                            <td title={item.categories?.map((c: any) => '- ' + c.nom).join('\n') || '—'}>
                                                <span >
                                                    {item.categories?.[0]
                                                        ? `${item.categories[0].nom.length > 15 ? item.categories[0].nom.substring(0, 15) + '...' : item.categories[0].nom}`
                                                        : '—'}
                                                </span>
                                                {item.categories?.length > 1 && (
                                                    <span >
                                                        ...+{item.categories.length - 1}
                                                    </span>
                                                )}
                                            </td>
                                            <td >
                                                <div
                                                    title={item.entrepots?.map((e: any) => `${e.nom} (${e.pivot?.quantite || 0})`).join('\n') || '—'}
                                                >
                                                    <span >
                                                        {item.entrepots?.[0]
                                                            ? `${item.entrepots[0].nom} (${formatCompactNumber(item.entrepots[0].pivot?.quantite || 0)})`
                                                            : '—'}
                                                    </span>

                                                    {item.entrepots?.length > 1 && (
                                                        <span >
                                                            ...+{item.entrepots.length - 1}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>                                            <td title={String(qteTheorequeLocale)}><span className={styles.countBadge} >{formatCompactNumber(qteTheorequeLocale)}</span></td>
                                            {inventaireFilter && <td title={String(qteComptee)}><span className={styles.countBadge}>{typeof qteComptee === 'number' ? formatCompactNumber(qteComptee) : qteComptee}</span></td>}
                                            {inventaireFilter && <td title={ecart} >
                                                {ecart === '-' ? '-' : (
                                                    <span className={`${styles.countBadge} ${ecartClass}`} >
                                                        {numericEcart > 0 ? `+${formatCompactNumber(numericEcart)}` : formatCompactNumber(numericEcart)}
                                                    </span>
                                                )}
                                            </td>}
                                            <td>
                                                <div >
                                                    <button className={styles.ActionButton} onClick={() => {
                                                        setSelectedArticle(item);
                                                        setModalType('details_article');
                                                    }}>Détails</button>
                                                    <button className={styles.DeleteBtn} onClick={() => {
                                                        setSelectedArticle(item);
                                                        setModalType('delete_article');
                                                    }}>Supprimer</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        )}
                    </table>
                </div>
            </section>
        </main>
    );
};

export default StockActifs;
