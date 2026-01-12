import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  name: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps, currentStep }) => {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2 md:gap-4">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300",
                  currentStep > step.id
                    ? "bg-success text-success-foreground shadow-md"
                    : currentStep === step.id
                    ? "bg-primary text-primary-foreground shadow-lg scale-110"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step.id ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.id
                )}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium md:inline",
                  currentStep >= step.id
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-8 md:w-16 transition-colors duration-300",
                  currentStep > step.id ? "bg-success" : "bg-muted"
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default ProgressSteps;
