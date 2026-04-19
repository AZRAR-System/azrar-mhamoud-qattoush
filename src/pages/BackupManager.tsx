/**
 * © 2025 - Developed by Mahmoud Qattoush
 * AZRAR Real Estate Management System - All Rights Reserved
 *
 * صفحة إدارة النسخ الاحتياطي (Backup Management Page)
 * - مراقبة حالة الأرشيف المحلي
 * - جدولة التنبيهات والأتمتة يومياً
 * - تشفير البيانات وحمايتها بكلمة مرور
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBackupManager } from '@/hooks/useBackupManager';
import { BackupManagerPageView } from '@/components/backup/BackupManagerPageView';

export const BackupManager: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const role = String(user?.الدور ?? '').trim().toLowerCase();
    if (role !== 'superadmin' && role !== 'admin') {
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  const page = useBackupManager();

  return <BackupManagerPageView page={page} />;
};

export default BackupManager;
