/**
 * University / campus catalog for map center + school switcher.
 * Coordinates are approximate campus centers (lng, lat).
 */

export const SCHOOL_COORDS = {
  北京大学: [116.3109, 39.9928],
  北京大学燕园: [116.3109, 39.9928],
  北京大学医学部: [116.356, 39.986],
  清华大学: [116.3269, 40.003],
  清华大学本部: [116.3269, 40.003],
  清华大学深圳国际研究生院: [113.979, 22.597],
  复旦大学: [121.5037, 31.2989],
  复旦大学邯郸校区: [121.5037, 31.2989],
  复旦大学江湾校区: [121.5045, 31.337],
  上海交通大学: [121.4365, 31.0252],
  上海交通大学闵行校区: [121.4365, 31.0252],
  上海交通大学徐汇校区: [121.4368, 31.2005],
  浙江大学: [120.0869, 30.3086],
  浙江大学紫金港校区: [120.0869, 30.3086],
  浙江大学玉泉校区: [120.1233, 30.2635],
  南京大学: [118.7802, 32.0563],
  南京大学鼓楼校区: [118.7802, 32.0563],
  南京大学仙林校区: [118.958, 32.119],
  武汉大学: [114.3655, 30.538],
  中山大学: [113.298, 23.096],
  中山大学南校区: [113.298, 23.096],
  中山大学东校区: [113.392, 23.065],
  南通理工学院: [120.809261, 32.041042],
  南通理工学院南通校区: [120.809261, 32.041042],
  南通理工学院海安校区: [120.4675, 32.5458],
}

/** Primary university name → campus list for the top-left switcher */
export const UNIVERSITY_CAMPUSES = {
  北京大学: ['北京大学', '北京大学燕园', '北京大学医学部'],
  清华大学: ['清华大学', '清华大学本部', '清华大学深圳国际研究生院'],
  复旦大学: ['复旦大学', '复旦大学邯郸校区', '复旦大学江湾校区'],
  上海交通大学: ['上海交通大学', '上海交通大学闵行校区', '上海交通大学徐汇校区'],
  浙江大学: ['浙江大学', '浙江大学紫金港校区', '浙江大学玉泉校区'],
  南京大学: ['南京大学', '南京大学鼓楼校区', '南京大学仙林校区'],
  武汉大学: ['武汉大学'],
  中山大学: ['中山大学', '中山大学南校区', '中山大学东校区'],
  南通理工学院: ['南通理工学院', '南通理工学院南通校区', '南通理工学院海安校区'],
}

export const SCHOOL_LIST = Object.keys(UNIVERSITY_CAMPUSES)

/** Infer geocoder city from school name */
export function schoolCityHint(schoolName = '') {
  const name = String(schoolName)
  if (/清华|北大|北京|人大|北航|北师|北邮/.test(name)) return '北京'
  if (/复旦|交大|上海|同济|华师大|上财/.test(name)) return '上海'
  if (/浙大|浙江|杭州/.test(name)) return '杭州'
  if (/南大|南京|东南|河海/.test(name)) return '南京'
  if (/武大|武汉|华科|华中/.test(name)) return '武汉'
  if (/中山|广州|暨南|华南/.test(name)) return '广州'
  if (/深圳/.test(name)) return '深圳'
  if (/南通|理工学院海安/.test(name)) return '南通'
  return '全国'
}

/**
 * Normalize display school to a university key in UNIVERSITY_CAMPUSES.
 */
export function resolveUniversityKey(schoolName = '') {
  const name = String(schoolName || '').trim()
  if (!name) return '南通理工学院'
  if (UNIVERSITY_CAMPUSES[name]) return name
  const hit = Object.keys(UNIVERSITY_CAMPUSES).find(
    (uni) => name.includes(uni) || uni.includes(name.replace(/校区|本部|分校|学院$/, '')),
  )
  return hit || name
}

/** Campus options for the switcher based on current profile school */
export function campusesForSchool(schoolName = '') {
  const key = resolveUniversityKey(schoolName)
  if (UNIVERSITY_CAMPUSES[key]) return UNIVERSITY_CAMPUSES[key]
  // Unknown university: keep itself as the only option (no wrong Nantong campuses)
  return [schoolName || key]
}

export function schoolCoord(schoolName) {
  const name = String(schoolName || '').trim()
  if (!name) return null
  if (SCHOOL_COORDS[name]) return SCHOOL_COORDS[name]
  const hit = Object.keys(SCHOOL_COORDS).find((key) => name.includes(key) || key.includes(name))
  return hit ? SCHOOL_COORDS[hit] : null
}
