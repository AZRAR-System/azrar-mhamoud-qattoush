
/**
 * © 2025 — Developed by Mahmoud Qattoush
 * Smart Behavior Engine - Rules Library
 * Defines the "Guidelines" for each field to enable self-learning and validation.
 */

import { SmartRule } from '../types';

export const FIELD_RULES: Record<string, SmartRule> = {
    // --- PERSON FIELDS ---
    'رقم_الهاتف': {
        learningKey: 'رقم_الهاتف',
        hint: 'يجب أن يبدأ الرقم بـ 07 ويتكون من 10 خانات (07XXXXXXXX)',
        expectedType: 'phone',
        validation: { regex: /^07[789]\d{7}$/ },
        severity: 'warning'
    },
    'الرقم_الوطني': {
        learningKey: 'الرقم_الوطني',
        hint: 'الرقم الوطني للأفراد يجب أن يتكون من 10 خانات رقمية',
        expectedType: 'number',
        validation: { regex: /^\d{10}$/ },
        severity: 'info'
    },
    'الاسم': {
        learningKey: 'الاسم',
        hint: 'يفضل كتابة الاسم رباعياً لضمان الدقة في العقود',
        expectedType: 'string',
        validation: { min: 5 }, // Min length
        severity: 'info'
    },

    // --- PROPERTY FIELDS ---
    'الكود_الداخلي': {
        learningKey: 'الكود_الداخلي',
        hint: 'استخدم نمط موحد للكود، مثال: A-101 (مبنى-رقم)',
        expectedType: 'string',
        validation: { regex: /^[A-Z0-9-]{3,10}$/i },
        severity: 'info'
    },
    'المساحة': {
        learningKey: 'المساحة',
        hint: 'المساحة بالمتر المربع، يجب أن تكون قيمة منطقية (50 - 5000)',
        expectedType: 'number',
        validation: { min: 50, max: 5000 },
        severity: 'warning'
    },
    'الإيجار_التقديري': {
        learningKey: 'الإيجار_التقديري',
        hint: 'القيمة السنوية المتوقعة، تؤثر على تقارير الأداء المالي',
        expectedType: 'number',
        validation: { min: 500 },
        severity: 'warning'
    },
    'رقم_اشتراك_الكهرباء': {
        learningKey: 'رقم_اشتراك_الكهرباء',
        hint: 'رقم المرجع في فاتورة الكهرباء (عادة 7-9 خانات)',
        expectedType: 'string',
        validation: { regex: /^\d{5,15}$/ },
        severity: 'info'
    },

    // --- CONTRACT FIELDS ---
    'القيمة_السنوية': {
        learningKey: 'القيمة_السنوية',
        hint: 'قيمة العقد السنوية، يجب أن تتناسب مع الإيجار التقديري للعقار',
        expectedType: 'number',
        validation: { min: 100 },
        severity: 'error' // Critical for financials
    },
    'مدة_العقد_بالاشهر': {
        learningKey: 'مدة_العقد_بالاشهر',
        hint: 'مدة العقد القياسية هي 12 شهراً',
        expectedType: 'number',
        validation: { min: 1, max: 60 }, // Up to 5 years
        severity: 'info'
    },
    'تكرار_الدفع': {
        learningKey: 'تكرار_الدفع',
        hint: 'عدد الدفعات في السنة (1, 2, 4, 12)',
        expectedType: 'number',
        validation: { options: ['1', '2', '4', '6', '12'] },
        severity: 'warning'
    }
};
