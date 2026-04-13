import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/services/storage';

export const useTheme = () => {
    const [isDark, setIsDark] = useState(() => {
        return document.documentElement.classList.contains('dark');
    });

    const toggleTheme = useCallback(() => {
        const newMode = !isDark;
        setIsDark(newMode);
        document.documentElement.classList.toggle('dark', newMode);
        document.documentElement.style.colorScheme = newMode ? 'dark' : 'light';
        
        try {
            void storage.setItem('theme', newMode ? 'dark' : 'light');
        } catch {
            // ignore
        }
    }, [isDark]);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    return {
        isDark,
        toggleTheme,
    };
};