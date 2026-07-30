import {
  Assets,
  ColorMatrix,
  ColorMatrixFilter,
  Container,
  Sprite,
  Texture,
} from "pixi.js";
import { Constructor } from "./constructor";
import { convertToKebabCase } from "./util";

const icons = import.meta.glob("../assets/*.{png,svg}", { eager: true });
const ICON_FILE_OVERRIDES: Record<string, string> = {
  AntiControlGate: "AntiControl.svg",
  BlochSphere: "BlochSphere.svg",
  PhaseGate: "Phase.svg",
  QftGate: "QFT.svg",
  QftDaggerGate: "QFTDagger.svg",
  RxGate: "Rx.svg",
  RyGate: "Ry.svg",
  RzGate: "Rz.svg",
};

function hasDefaultExport(module: unknown): module is { default: string } {
  return typeof module === "object" && module !== null && "default" in module;
}

export declare class Iconable {
  createSprites(gateType: string): Promise<{
    sprite: Sprite;
    whiteSprite: Sprite;
  }>;
}

const WHITE_FILTER_MATRIX = [
  0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
] as ColorMatrix;

export function IconableMixin<TBase extends Constructor<Container>>(
  Base: TBase
): Constructor<Iconable> & TBase {
  return class IconableMixinClass extends Base {
    private textureCache: Map<string, Texture> = new Map();

    async createSprites(gateType: string) {
      const texture = await this.loadTexture(gateType);

      return {
        sprite: this.createSprite(texture),
        whiteSprite: this.createWhiteSprite(texture),
      };
    }

    private async loadTexture(gateType: string): Promise<Texture> {
      try {
        if (this.textureCache.has(gateType)) {
          return this.textureCache.get(gateType)!;
        }

        const iconPath = this.iconPathFor(gateType);

        const iconModule = icons[iconPath];
        if (!iconModule || !hasDefaultExport(iconModule)) {
          throw new Error(`Icon not found for gate type: ${gateType}`);
        }

        const texture = await Assets.load(iconModule.default);

        this.textureCache.set(gateType, texture);

        return texture;
      } catch (error) {
        if (import.meta.env.MODE !== "test") {
          console.error(
            `Failed to load texture for gate type: ${gateType}`,
            error
          );
        }
        // アイコン未配置やテスト環境の asset fetch 失敗時も、ゲート本体の表示は続ける。
        return Texture.WHITE;
      }
    }

    private createSprite(texture: Texture): Sprite {
      return new Sprite(texture);
    }

    /**
     * 既存の kebab-case 画像と、旧 Qni 由来の大文字 SVG 名の両方を解決する。
     */
    private iconPathFor(gateType: string): string {
      const override = ICON_FILE_OVERRIDES[gateType];
      if (override) {
        return `../assets/${override}`;
      }

      const iconBaseName = convertToKebabCase(gateType);
      return `../assets/${iconBaseName}.png` in icons
        ? `../assets/${iconBaseName}.png`
        : `../assets/${iconBaseName}.svg`;
    }

    private createWhiteSprite(texture: Texture): Sprite {
      const sprite = new Sprite(texture);
      if (import.meta.env.MODE === "test") {
        return sprite;
      }

      const whiteFilter = new ColorMatrixFilter();

      whiteFilter.matrix = WHITE_FILTER_MATRIX;
      sprite.filters = [whiteFilter];

      return sprite;
    }
  };
}
