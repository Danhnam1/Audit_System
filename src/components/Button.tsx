import React from 'react';

type ButtonVariant =
	| 'primary'
	| 'secondary'
	| 'success'
	| 'danger'
	| 'warning'
	| 'gray'
	| 'ghost'
	| 'outline';

type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	isLoading?: boolean;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
	sm: 'px-3 py-1.5 text-sm',
	md: 'px-4 py-2 text-sm',
	lg: 'px-5 py-2.5 text-base',
};

const variantClasses: Record<ButtonVariant, string> = {
	primary: 'bg-primary-600 hover:bg-primary-700 text-white',
	secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
	success: 'bg-green-600 hover:bg-green-700 text-white',
	danger: 'bg-red-600 hover:bg-red-700 text-white',
	warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
	gray: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
	ghost: 'bg-transparent text-primary-600 hover:bg-primary-50',
	outline: 'bg-transparent border border-primary-600 text-primary-600 hover:bg-primary-50',
};

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const Button: React.FC<ButtonProps> = ({
	variant = 'primary',
	size = 'md',
	isLoading = false,
	leftIcon,
	rightIcon,
	className,
	disabled,
	children,
	...rest
}) => {
	const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed';

	return (
		<button
			className={cn(base, sizeClasses[size], variantClasses[variant], className)}
			disabled={disabled || isLoading}
			{...rest}
		>
			{isLoading && (
				<span
					className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent"
					aria-hidden
				/>
			)}
			{leftIcon && <span className={cn('mr-2', isLoading && 'opacity-70')}>{leftIcon}</span>}
			<span className={cn(isLoading && 'opacity-90')}>{children}</span>
			{rightIcon && <span className={cn('ml-2', isLoading && 'opacity-70')}>{rightIcon}</span>}
		</button>
	);
};

export default Button;

