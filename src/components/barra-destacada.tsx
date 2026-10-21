import { Rectangle, type RectangleProps } from "recharts";

/**
 * Forma da barra quando o mouse passa por cima: a barra clareia um pouco e ganha
 * uma borda da mesma cor. Mantém a cor própria de cada barra.
 */
export function BarraDestacada(props: RectangleProps) {
  return <Rectangle {...props} fillOpacity={0.8} stroke={props.fill} strokeWidth={3} />;
}
