import AMapLoader from '@amap/amap-jsapi-loader'

let amapPromise

export function loadAMap() {
  const key = import.meta.env.VITE_AMAP_KEY
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE

  if (!key || !securityJsCode) {
    return Promise.reject(new Error('缺少高德地图环境变量配置'))
  }

  window._AMapSecurityConfig = { securityJsCode }

  if (!amapPromise) {
    amapPromise = AMapLoader.load({
      key,
      version: '2.0',
      plugins: [
        'AMap.Geolocation',
        'AMap.CitySearch',
        'AMap.Geocoder',
        'AMap.Scale',
        'AMap.ToolBar',
      ],
    })
  }

  return amapPromise
}
