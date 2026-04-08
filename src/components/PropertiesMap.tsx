/**
 * خريطة العقارات
 * عرض مواقع العقارات على خريطة جوجل
 */

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { getProperties } from '@/services/db/properties';

export function PropertiesMap() {
  const properties = getProperties();
  const [selectedProperty, setSelectedProperty] = useState<any>(null);

  const propertiesWithLocation = properties.filter(p => p.latitude && p.longitude);

  if (propertiesWithLocation.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
        <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">لا يوجد عقارات مع مواقع جغرافية مسجلة حتى الآن</p>
      </div>
    );
  }

  const firstProperty = propertiesWithLocation[0];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <iframe
          src={`https://www.google.com/maps/embed/v1/view?key=YOUR_API_KEY&center=${firstProperty.latitude},${firstProperty.longitude}&zoom=12`}
          width="100%"
          height="500"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="خريطة العقارات"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900 mb-3">العقارات على الخريطة</h3>
        <div className="grid gap-2 max-h-64 overflow-y-auto">
          {propertiesWithLocation.map((p) => (
            <button
              key={p.رقم_العقار}
              onClick={() => setSelectedProperty(p)}
              className={`
                flex items-center justify-between p-3 rounded-lg transition-colors text-right
                ${selectedProperty?.رقم_العقار === p.رقم_العقار ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100 border border-transparent'}
              `}
            >
              <div className="text-right">
                <p className="font-medium text-sm">{p.الكود_الداخلي || p.رقم_العقار}</p>
                <p className="text-xs text-gray-500">{p.العنوان || '-'}</p>
              </div>
              <div className={`
                px-2 py-1 rounded text-xs font-medium
                ${p.حالة_العقار === 'مؤجر' ? 'bg-green-100 text-green-700' :
                  p.حالة_العقار === 'شاغر' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
              `}>
                {p.حالة_العقار || 'غير محدد'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}