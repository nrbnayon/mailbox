import React from "react";
import { Check, ChevronDown } from "lucide-react";
import * as Select from "@radix-ui/react-select";

interface Model {
  id: string;
  name: string;
  developer: string;
  contextWindow: number;
}

const models: Model[] = [
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral-8x7b-32768",
    developer: "Mistral",
    contextWindow: 32768,
  },
  {
    id: "llama-3-70b",
    name: "Llama 3 70B",
    developer: "Meta",
    contextWindow: 128000,
  },
  {
    id: "gemma-7b",
    name: "Gemma 7B",
    developer: "Google",
    contextWindow: 8192,
  },
  {
    id: "deepseek-coder",
    name: "DeepSeek Coder",
    developer: "DeepSeek",
    contextWindow: 32768,
  },
  {
    id: "deepseek-llm",
    name: "DeepSeek LLM",
    developer: "DeepSeek",
    contextWindow: 32768,
  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
}) => {
  const selectedModelData = models.find((m) => m.id === selectedModel);

  return (
    <Select.Root value={selectedModel} onValueChange={onModelChange}>
      <Select.Trigger className='inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border bg-background hover:bg-accent'>
        <Select.Value>
          Using {selectedModelData?.name} ({selectedModelData?.developer})
        </Select.Value>
        <Select.Icon>
          <ChevronDown className='h-4 w-4' />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className='z-50 min-w-[220px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md'>
          <Select.ScrollUpButton className='flex items-center justify-center h-[25px] bg-white text-violet11 cursor-default'>
            <ChevronDown className='h-4 w-4 rotate-180' />
          </Select.ScrollUpButton>

          <Select.Viewport className='p-1'>
            {models.map((model) => (
              <Select.Item
                key={model.id}
                value={model.id}
                className='relative flex items-center gap-2 px-8 py-2 text-sm rounded-sm hover:bg-accent cursor-pointer outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground'
              >
                <Select.ItemIndicator className='absolute left-2 inline-flex items-center justify-center'>
                  <Check className='h-4 w-4' />
                </Select.ItemIndicator>
                <div>
                  <div className='font-medium'>{model.name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {model.developer} · {model.contextWindow.toLocaleString()}{" "}
                    tokens
                  </div>
                </div>
              </Select.Item>
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className='flex items-center justify-center h-[25px] bg-white text-violet11 cursor-default'>
            <ChevronDown className='h-4 w-4' />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

export default ModelSelector;
