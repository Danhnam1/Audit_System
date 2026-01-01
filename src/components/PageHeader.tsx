import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
}

export const PageHeader = ({ title, subtitle, rightContent }: PageHeaderProps) => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md">
      <div className="px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-[#5b6166] text-sm mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {rightContent ? <div className="flex-shrink-0">{rightContent}</div> : null}
      </div>
    </div>
  );
};

export default PageHeader;


