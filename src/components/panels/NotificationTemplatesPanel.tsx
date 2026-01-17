import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/context/ToastContext';
import {
  Edit,
  Trash2,
  Plus,
  MessageSquare,
  Check,
  Copy,
  Eye,
  EyeOff,
  MessageCircle,
  Search,
  RefreshCw
} from 'lucide-react';
import {
  NotificationTemplates,
  NotificationTemplate,
  TemplateContext,
  fillTemplateComplete,
  openWhatsApp
} from '@/services/notificationTemplates';
import { applyOfficialBrandSignature } from '@/utils/brandSignature';
import { DS } from '@/constants/designSystem';

const getStringProp = (value: unknown, key: string): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const prop = record[key];
  return typeof prop === 'string' ? prop : undefined;
};

/**
 * مكون إدارة نماذج الإشعارات والرسائل
 * يسمح بعرض وتعديل وتجربة النماذج المختلفة
 */
export const NotificationTemplatesPanel: React.FC = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState<NotificationTemplate[]>(() =>
    NotificationTemplates.getAll()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<NotificationTemplate>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewContext, setPreviewContext] = useState<TemplateContext>({});

  // تصفية النماذج
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.name.toLowerCase().includes(lower) ||
          t.title.toLowerCase().includes(lower) ||
          t.body.toLowerCase().includes(lower)
      );
    }

    return filtered;
  }, [templates, selectedCategory, searchTerm]);

  // معالجات التحرير
  const handleEdit = (template: NotificationTemplate) => {
    setEditingId(template.id);
    setEditData({ ...template });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editData.title || !editData.body) return;

    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...updates } = editData;
    const updated = NotificationTemplates.update(editingId, updates);
    if (updated) {
      setTemplates(NotificationTemplates.getAll());
      setEditingId(null);
      setEditData({});
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const ok = await toast.confirm({
      title: 'حذف نموذج',
      message: 'هل تريد حذف هذا النموذج؟',
      confirmText: 'حذف',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;
    NotificationTemplates.delete(id);
    setTemplates(NotificationTemplates.getAll());
  };

  const handleToggleEnabled = (id: string) => {
    NotificationTemplates.toggleEnabled(id);
    setTemplates(NotificationTemplates.getAll());
  };

  const handleReset = async () => {
    const ok = await toast.confirm({
      title: 'إعادة تعيين',
      message: 'هل تريد إعادة تعيين جميع النماذج إلى القيم الافتراضية؟',
      confirmText: 'نعم',
      cancelText: 'إلغاء',
      isDangerous: true,
    });
    if (!ok) return;
    NotificationTemplates.reset();
    setTemplates(NotificationTemplates.getAll());
    setEditingId(null);
    setPreviewId(null);
  };

  const handleAddTemplate = () => {
    const newTemplate = NotificationTemplates.add({
      id: `custom_${Date.now()}`,
      name: 'نموذج جديد',
      category: 'reminder',
      title: 'العنوان',
      body: 'النص الأساسي',
      enabled: true,
      tags: []
    });
    setTemplates(NotificationTemplates.getAll());
    handleEdit(newTemplate);
  };

  const handleCopyTemplate = (template: NotificationTemplate) => {
    const preview = fillTemplateComplete(template, previewContext);
    const raw = `${preview.title}\n\n${preview.body}`;
    const text = raw.trim().length > 0 ? applyOfficialBrandSignature(raw) : raw;
    navigator.clipboard.writeText(text);
  };

  const handleOpenWhatsApp = (template: NotificationTemplate) => {
    const preview = fillTemplateComplete(template, previewContext);
    const message = `${preview.title}\n\n${preview.body}`;

    const phone = getStringProp(previewContext, 'phone');
    if (!phone || phone.trim().length === 0) {
      toast.warning('يرجى إدخال رقم هاتف للمستأجر قبل فتح واتساب');
      return;
    }

    openWhatsApp(message, phone);
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      {/* Header */}
      <div className={DS.components.pageHeader}>
        <div>
          <h2 className={DS.components.pageTitle}>نماذج الرسائل والإشعارات</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            إدارة وتخصيص نماذج الرسائل للمستأجرين والتذكيرات
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleReset}
            title="إعادة تعيين إلى القيم الافتراضية"
          >
            <RefreshCw size={18} />
          </Button>
          <Button variant="primary" onClick={handleAddTemplate} className="gap-2">
            <Plus size={18} /> نموذج جديد
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <Card className="flex flex-col md:flex-row gap-4 p-4">
        <Input
          type="text"
          placeholder="بحث في النماذج..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search size={18} />}
          className="flex-1"
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === null ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            الكل
          </Button>
          {(['reminder', 'due', 'late', 'warning', 'legal'] as const).map(
            (category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'reminder' && 'تذكيرات'}
                {category === 'due' && 'استحقاق'}
                {category === 'late' && 'تأخر'}
                {category === 'warning' && 'إنذارات'}
                {category === 'legal' && 'قانوني'}
              </Button>
            )
          )}
        </div>
      </Card>

      {/* Templates Grid */}
      <div className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <Card className="p-12 text-center">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-slate-500">لا توجد نماذج مطابقة</p>
          </Card>
        ) : (
          filteredTemplates.map((template) => (
            <div key={template.id}>
              {editingId === template.id ? (
                // وضع التحرير
                <Card className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold mb-2">
                        اسم النموذج
                      </label>
                      <Input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) =>
                          setEditData({ ...editData, name: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2">
                        العنوان
                      </label>
                      <Input
                        type="text"
                        value={editData.title || ''}
                        onChange={(e) =>
                          setEditData({ ...editData, title: e.target.value })
                        }
                        placeholder="مثال: {{tenantName}} - {{amount}}"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold mb-2">
                        النص الأساسي
                      </label>
                      <textarea
                        value={editData.body || ''}
                        onChange={(e) =>
                          setEditData({ ...editData, body: e.target.value })
                        }
                        rows={6}
                        placeholder={`استخدم {{}} للمتغيرات:
{{tenantName}} - اسم المستأجر
{{amount}} - المبلغ
{{dueDate}} - تاريخ الاستحقاق
{{daysLate}} - أيام التأخر
{{propertyCode}} - كود العقار
{{contractNumber}} - رقم العقد
{{remainingAmount}} - المبلغ المتبقي`}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 font-mono text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        onClick={handleSaveEdit}
                        className="flex-1 gap-2"
                      >
                        <Check size={16} /> حفظ التغييرات
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditData({});
                        }}
                        className="flex-1"
                      >
                        إلغاء
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                // وضع العرض
                <Card
                  className={`p-4 transition-all ${
                    !template.enabled
                      ? 'opacity-60 bg-slate-50 dark:bg-slate-800'
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold">{template.name}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-bold ${
                            template.category === 'reminder'
                              ? 'bg-indigo-100 text-indigo-700'
                              : template.category === 'due'
                              ? 'bg-green-100 text-green-700'
                              : template.category === 'late'
                              ? 'bg-orange-100 text-orange-700'
                              : template.category === 'warning'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {template.category === 'reminder' && 'تذكير'}
                          {template.category === 'due' && 'استحقاق'}
                          {template.category === 'late' && 'تأخر'}
                          {template.category === 'warning' && 'إنذار'}
                          {template.category === 'legal' && 'قانوني'}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-bold ml-auto ${
                            template.enabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {template.enabled ? '✓ مفعل' : '✗ معطل'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {template.title}
                      </p>
                      <div className="text-xs text-slate-500 flex gap-2 flex-wrap">
                        {template.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mr-4">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          handleToggleEnabled(template.id)
                        }
                        title={template.enabled ? 'تعطيل' : 'تفعيل'}
                      >
                        {template.enabled ? (
                          <Eye size={16} />
                        ) : (
                          <EyeOff size={16} />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewId(previewId === template.id ? null : template.id)}
                        title="معاينة"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEdit(template)}
                        title="تعديل"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopyTemplate(template)}
                        title="نسخ"
                      >
                        <Copy size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenWhatsApp(template)}
                        className="bg-green-100 hover:bg-green-200 text-green-700"
                        title="فتح في واتساب"
                      >
                        <MessageCircle size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-red-100 hover:bg-red-200 text-red-700"
                        onClick={() => handleDeleteTemplate(template.id)}
                        title="حذف"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* Preview Section */}
                  {previewId === template.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                          بيانات المعاينة
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="text"
                            placeholder="اسم المستأجر"
                            value={previewContext.tenantName || ''}
                            onChange={(e) =>
                              setPreviewContext({
                                ...previewContext,
                                tenantName: e.target.value
                              })
                            }
                            uiSize="sm"
                          />
                          <Input
                            type="text"
                            placeholder="كود العقار"
                            value={previewContext.propertyCode || ''}
                            onChange={(e) =>
                              setPreviewContext({
                                ...previewContext,
                                propertyCode: e.target.value
                              })
                            }
                            uiSize="sm"
                          />
                          <Input
                            type="number"
                            placeholder="المبلغ"
                            value={previewContext.amount || 0}
                            onChange={(e) =>
                              setPreviewContext({
                                ...previewContext,
                                amount: Number(e.target.value)
                              })
                            }
                            uiSize="sm"
                          />
                          <Input
                            type="number"
                            placeholder="أيام التأخر"
                            value={previewContext.daysLate || 0}
                            onChange={(e) =>
                              setPreviewContext({
                                ...previewContext,
                                daysLate: Number(e.target.value)
                              })
                            }
                            uiSize="sm"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                          معاينة الرسالة
                        </p>
                        <div className="bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700">
                          <p className="font-bold text-slate-900 dark:text-white mb-2">
                            {fillTemplateComplete(template, previewContext)
                              .title}
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {fillTemplateComplete(template, previewContext)
                              .body}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <Card className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
          💡 ملاحظات مهمة
        </h4>
        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
          <li>
            • استخدم <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">
              {'{{'} {'}}'}
            </code> للمتغيرات (مثل: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">
              {'{'}{'{'} tenantName {'}'}{'}'} 
            </code>)
          </li>
          <li>
            • النماذج المعطلة لن تظهر في القوائم ولن يتم استخدامها
          </li>
          <li>
            • يمكنك نسخ الرسالة أو فتحها مباشرة في واتساب
          </li>
          <li>
            • التغييرات تُحفظ تلقائياً في ذاكرة المتصفح
          </li>
          <li>
            • استخدم "إعادة التعيين" لاستعادة النماذج الافتراضية
          </li>
        </ul>
      </Card>
    </div>
  );
};

export default NotificationTemplatesPanel;
