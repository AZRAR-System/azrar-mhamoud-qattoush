import { useState, useEffect } from 'react';
import {
  Info,
  Users,
  Home,
  FileText,
  BrainCircuit,
  CloudLightning,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { AppModal } from '@/components/ui/AppModal';

const STEPS = [
  {
    title: 'مرحباً بك في نظام خبرني العقاري',
    description: 'نظام إدارة عقارات متكامل يعتمد على الذكاء والأتمتة لتسهيل أعمالك اليومية.',
    icon: Info,
    color: 'bg-indigo-600',
    features: [
      'لوحة قيادة شاملة للمؤشرات الحيوية',
      'إدارة ذكية للعقود والدفعات',
      'نظام أرشفة ومتابعة دقيق',
    ],
  },
  {
    title: 'إدارة المستأجرين والملاك',
    description: 'سجل متكامل للأشخاص مع تصنيف الأدوار (مالك، مستأجر، كفيل).',
    icon: Users,
    color: 'bg-purple-600',
    features: [
      'إضافة وتعديل بيانات الأشخاص',
      'تصنيف وتقييم سلوك المستأجرين',
      'نظام القائمة السوداء (Blacklist) للحماية',
    ],
  },
  {
    title: 'إدارة المحفظة العقارية',
    description: 'سجل مفصل لجميع الوحدات السكنية والتجارية.',
    icon: Home,
    color: 'bg-emerald-600',
    features: [
      'إضافة العقارات وتحديد المالك',
      'متابعة حالة الإشغال (شاغر/مؤجر)',
      'سجل الصيانة والخدمات (كهرباء/مياه)',
    ],
  },
  {
    title: 'محرك العقود الذكي',
    description: 'إنشاء عقود إيجار احترافية مع توليد تلقائي للدفعات.',
    icon: FileText,
    color: 'bg-indigo-600',
    features: [
      'حساب تلقائي للكمبيالات والتواريخ',
      'تنبيهات قرب انتهاء العقود',
      'إجراء المخالصات والتجديد بنقرة واحدة',
    ],
  },
  {
    title: 'المحرك الذكي (Smart Engine)',
    description: 'النظام يتعلم من مدخلاتك ليقوم بتعبئة البيانات نيابة عنك.',
    icon: BrainCircuit,
    color: 'bg-orange-600',
    features: [
      'اقتراح القيم بناءً على الأنماط السابقة',
      'كشف الأخطاء والقيم الشاذة تلقائياً',
      'تطبيق قواعد التحقق الذكية',
    ],
  },
  {
    title: 'التنبيهات والمزامنة',
    description: 'ابق على اطلاع دائم بحالة النظام والاتصال.',
    icon: CloudLightning,
    color: 'bg-cyan-600',
    features: [
      'تنبيهات فورية للدفعات المستحقة',
      'مزامنة البيانات مع السيرفر في الخلفية',
      'مؤشر حالة الاتصال (Online/Local)',
    ],
  },
];

export const OnboardingGuide: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem('khaberni_onboarding_completed');
    if (!completed) {
      setIsVisible(true);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem('khaberni_onboarding_completed', 'true');
    setIsVisible(false);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  if (!isVisible) return null;

  const Step = STEPS[currentStep];
  const Icon = Step.icon;

  return (
    <AppModal
      open={isVisible}
      onClose={handleComplete}
      hideHeader
      title="جولة تعريفية"
      size="2xl"
      className="bg-slate-900/80"
      contentClassName="rounded-3xl overflow-hidden flex flex-col md:flex-row min-h-[400px]"
      bodyClassName="p-0 overflow-hidden"
      closeOnBackdrop
      closeOnEsc
    >
      {/* Left Side (Image/Icon) */}
      <div
        className={`p-8 md:w-1/3 flex flex-col items-center justify-center text-white text-center ${Step.color} transition-colors duration-500`}
      >
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Icon size={40} />
        </div>
        <h3 className="font-bold text-xl mb-2">الخطوة {currentStep + 1}</h3>
        <div className="flex gap-1 mt-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      </div>

      {/* Right Side (Content) */}
      <div className="p-8 md:w-2/3 flex flex-col">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">{Step.title}</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
            {Step.description}
          </p>

          <div className="space-y-3">
            {Step.features.map((feat, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700"
              >
                <div className={`p-1 rounded-full ${Step.color} bg-opacity-10 text-current`}>
                  <Check size={14} className={Step.color.replace('bg-', 'text-')} />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {feat}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={handleComplete}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            تخطي الجولة
          </button>

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <ChevronRight size={20} />
              </button>
            )}

            <button
              onClick={handleNext}
              className={`px-6 py-2 rounded-xl text-white font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition transform active:scale-95 ${Step.color}`}
            >
              {currentStep === STEPS.length - 1 ? 'ابدأ الاستخدام' : 'التالي'}
              {currentStep < STEPS.length - 1 ? <ChevronLeft size={20} /> : <Check size={20} />}
            </button>
          </div>
        </div>
      </div>
    </AppModal>
  );
};
