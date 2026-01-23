import React from 'react';

interface UserTagProps {
    userId: string;
    userMap: Map<string, any>;
    size?: 'small' | 'medium' | 'large';
    showEmail?: boolean;
    className?: string;
}

export const UserTag: React.FC<UserTagProps> = ({
    userId,
    userMap,
    size = 'medium',
    showEmail = false,
    className = '',
}) => {
    const user = userMap.get(userId);

    // Fallback if user not found
    const displayName = user?.fullName || user?.email || userId;
    const email = user?.email || '';
    const initials = displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Size configurations
    const sizeClasses = {
        small: {
            avatar: 'w-6 h-6 text-xs',
            text: 'text-xs',
            container: 'gap-1.5',
        },
        medium: {
            avatar: 'w-8 h-8 text-sm',
            text: 'text-sm',
            container: 'gap-2',
        },
        large: {
            avatar: 'w-10 h-10 text-base',
            text: 'text-base',
            container: 'gap-2.5',
        },
    };

    const config = sizeClasses[size];

    return (
        <div
            className={`inline-flex items-center ${config.container} ${className}`}
            title={showEmail && email ? `${displayName} (${email})` : displayName}
        >
            {/* Avatar */}
            <div
                className={`${config.avatar} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0`}
            >
                {initials}
            </div>

            {/* User info */}
            <div className="flex flex-col min-w-0">
                <span className={`${config.text} font-medium text-gray-900 truncate`}>
                    {displayName}
                </span>
                {showEmail && email && displayName !== email && (
                    <span className="text-xs text-gray-500 truncate">{email}</span>
                )}
            </div>
        </div>
    );
};

export default UserTag;
