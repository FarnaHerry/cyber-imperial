export interface Point {
  x: number
  y: number
}

/** 卷轴上的排版参数（单位：画布 CSS 像素） */
export interface StageMetrics {
  width: number
  height: number
  dpr: number
}
