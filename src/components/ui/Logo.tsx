import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import logoLight from '@/assets/logo/icon1.png';
import logoDark from '@/assets/logo/icon2.png';

interface LogoProps {
    className?: string;
    size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 144 }) => {
    const { isDark } = useTheme();

    const logoSrc = isDark ? logoLight : logoDark;
    // dark mode → icon1 (أبيض) | light mode → icon2 (أسود)

    return (
        <img
            src={logoSrc}
            alt="AZRAR System Logo"
            className={`object-contain drop-shadow-2xl transition-opacity duration-300 ${className}`}
            style={{
                width: size,
                height: size,
            }}
            loading="eager"
            decoding="sync"
        />
    );
};