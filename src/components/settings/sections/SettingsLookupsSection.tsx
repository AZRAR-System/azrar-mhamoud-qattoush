import { Edit2, FileJson, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { RBACGuard } from '@/components/shared/RBACGuard';
import type { SettingsPageModel } from '@/hooks/useSettingsPage';

type Props = { page: SettingsPageModel };

export function SettingsLookupsSection({ page }: Props) {
  const {
    activeCategory,
    catSearchTerm,
    filteredCategories,
    handleAddLookup,
    handleDeleteCategory,
    handleDeleteLookup,
    handleExportLookupsCSV,
    handleExportLookupsJSON,
    handleImportLookups,
    lookupItems,
    openAddTableModal,
    openEditTableModal,
    setActiveCategory,
    setCatSearchTerm,
    settingsNoAccessFallback,
  } = page;

  return (
    <RBACGuard requiredPermission="SETTINGS_ADMIN" fallback={settingsNoAccessFallback}>
      <div className="flex min-h-[min(75vh,900px)] animate-fade-in rounded-[1.5rem] overflow-hidden border border-slate-200/60 dark:border-slate-800/60 glass-card">
        <div className="w-80 border-l border-white/30 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-slate-700">
            <input
              placeholder="بحث في القوائم..."
              className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 px-3 text-sm mb-3"
              value={catSearchTerm}
              onChange={(e) => setCatSearchTerm(e.target.value)}
            />
            <button
              onClick={openAddTableModal}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-bold flex items-center justify-center gap-2"
            >
              <Plus size={16} /> إنشاء جدول
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer ${activeCategory?.id === cat.id ? 'bg-white dark:bg-slate-800 border-indigo-500 border-l-4' : 'hover:bg-white dark:hover:bg-slate-800'}`}
                onClick={() => setActiveCategory(cat)}
              >
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{cat.label}</span>
                  <span className="text-[10px] text-slate-400">{cat.name}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditTableModal(cat);
                    }}
                    className="p-1 text-indigo-400 hover:bg-indigo-50 rounded"
                    aria-label="تعديل الجدول"
                    title="تعديل الجدول"
                  >
                    <Edit2 size={12} />
                  </button>
                  {!cat.isSystem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(cat.id);
                      }}
                      className="p-1 text-red-400 hover:bg-red-50 rounded"
                      aria-label="حذف الجدول"
                      title="حذف الجدول"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white/70 dark:bg-slate-900/50">
          {activeCategory ? (
            <>
              <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/20">
                <div>
                  <h3 className="text-xl font-bold">{activeCategory.label}</h3>
                  <p className="text-xs text-slate-400">
                    {activeCategory.name} • {lookupItems.length} عنصر
                  </p>
                </div>
                <div className="flex gap-2">
                  <label className="py-2 px-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-gray-50">
                    <Upload size={14} /> استيراد
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportLookups}
                      aria-label="استيراد JSON"
                      title="استيراد JSON"
                    />
                  </label>
                  <button
                    onClick={handleExportLookupsJSON}
                    className="py-2 px-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-gray-50"
                  >
                    <FileJson size={14} /> JSON
                  </button>
                  <button
                    onClick={handleExportLookupsCSV}
                    className="py-2 px-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-gray-50"
                  >
                    <FileSpreadsheet size={14} /> CSV
                  </button>
                  <button
                    onClick={handleAddLookup}
                    className="py-2 px-4 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 ml-2"
                  >
                    <Plus size={16} /> إضافة
                  </button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {lookupItems.map((item) => (
                    <div
                      key={item.id}
                      className="group relative bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 p-4 rounded-xl hover:shadow-md transition"
                    >
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        {item.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteLookup(item.id)}
                        className="absolute top-2 left-2 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 p-1 rounded"
                        aria-label="حذف العنصر"
                        title="حذف العنصر"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {lookupItems.length === 0 && (
                    <div className="col-span-full text-center py-10 text-slate-400">
                      القائمة فارغة
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              اختر جدولاً لإدارته
            </div>
          )}
        </div>
      </div>
    </RBACGuard>
  );
}
