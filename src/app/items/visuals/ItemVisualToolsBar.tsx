/**
 * ItemVisualToolsBar — reusable Upload / Enlarge / →2D / →3D / Meshy tool row.
 * Location: src/app/items/visuals/ItemVisualToolsBar.tsx
 */
import type { ReactElement } from 'react';
import {
  ArrowRight,
  Eye,
  Sparkle,
  UploadSimple
} from '@phosphor-icons/react';
import { Button } from '../../../shared/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../shared/ui/tooltip';
import type { ItemVisualMode } from './useItemVisualTools';
import type { ItemVisualToolsApi } from './useItemVisualTools';

export interface ItemVisualToolsBarProps {
  mode: ItemVisualMode;
  tools: ItemVisualToolsApi;
  showUpload?: boolean;
  showEnlarge?: boolean;
  showMeshyGenerate2d?: boolean;
  meshyConfigured?: boolean;
  assetsPhase?: string;
  onUploadClick?: () => void;
  onEnlargeClick?: () => void;
  className?: string;
  toolBtnClassName?: string;
}

function withTooltip(label: string, control: ReactElement) {
  return (
    <Tooltip pinOnClick={false}>
      <TooltipTrigger asChild>
        <span className="inline-flex">{control}</span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

const DEFAULT_TOOL_BTN =
  'size-7 min-h-7 min-w-7 p-0 shadow-sm disabled:pointer-events-none disabled:opacity-40';

export function ItemVisualToolsBar({
  mode,
  tools,
  showUpload = false,
  showEnlarge = true,
  showMeshyGenerate2d = true,
  meshyConfigured = false,
  assetsPhase,
  onUploadClick,
  onEnlargeClick,
  className = 'flex w-full flex-wrap items-center justify-center gap-1.5',
  toolBtnClassName = DEFAULT_TOOL_BTN,
}: ItemVisualToolsBarProps) {
  const uploadLabel =
    mode === '2d' ? 'PNG/JPEG-Bild hochladen' : 'GLB-Modell hochladen';

  return (
    <div
      className={className}
      data-item-workbench-visual-tools
      data-item-visual-tools
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {showUpload &&
        onUploadClick &&
        withTooltip(
          uploadLabel,
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={toolBtnClassName}
            aria-label={uploadLabel}
            data-item-workbench-visual-upload
            data-item-visual-upload
            onClick={onUploadClick}
          >
            <UploadSimple className="size-3.5" aria-hidden="true" />
          </Button>,
        )}

      {showEnlarge &&
        onEnlargeClick &&
        withTooltip(
          'Vorschau vergrößern',
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={toolBtnClassName}
            aria-label="Vorschau vergrößern"
            data-item-workbench-visual-enlarge
            data-item-visual-enlarge
            disabled={!tools.canPreviewEnlarge}
            onClick={() => {
              if (!tools.canPreviewEnlarge) return;
              onEnlargeClick();
            }}
          >
            <Eye className="size-3.5" aria-hidden="true" />
          </Button>,
        )}

      {tools.showConvertTools &&
        withTooltip(
          tools.to2dLabel,
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={`${toolBtnClassName} min-w-11 gap-0.5 px-1`}
            aria-label="Nach 2D — Seitenprofil-Snapshot"
            data-item-workbench-visual-convert
            data-item-workbench-visual-to-2d
            data-item-visual-to-2d
            disabled={!tools.canSnapshotTo2d && mode === '3d'}
            onClick={tools.handleTo2d}
          >
            <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-none">2D</span>
          </Button>,
        )}

      {tools.showConvertTools &&
        withTooltip(
          tools.to3dLabel,
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={`${toolBtnClassName} min-w-11 gap-0.5 px-1`}
            aria-label="Nach 3D"
            data-item-workbench-visual-to-3d
            data-item-visual-to-3d
            disabled={!tools.canEditModel3d}
            onClick={tools.handleTo3d}
          >
            <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-none">3D</span>
          </Button>,
        )}

      {showMeshyGenerate2d &&
        tools.showConvertTools &&
        mode === '2d' &&
        withTooltip(
          tools.meshyGenerate2dLabel,
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={toolBtnClassName}
            aria-label="2D-Bild generieren"
            data-item-workbench-visual-generate-2d
            data-item-visual-generate-2d
            data-item-thumbnail-generate={
              meshyConfigured && assetsPhase !== 'failed' ? true : undefined
            }
            disabled={!tools.canMeshyGenerate2d}
            onClick={tools.handleMeshyGenerate2d}
          >
            <Sparkle className="size-3.5" aria-hidden="true" />
          </Button>,
        )}
    </div>
  );
}
