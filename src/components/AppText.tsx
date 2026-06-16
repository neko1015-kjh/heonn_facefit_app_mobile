import { Text as RNText, StyleSheet, TextProps } from 'react-native';

// 앱 전체에서 쓰는 공용 글자 컴포넌트입니다.
// 기존 react-native의 Text 대신 이걸 쓰면 자동으로 Pretendard 폰트가 적용됩니다.
// 글자 굵기(fontWeight)에 맞는 Pretendard 파일을 골라줍니다.

// 굵기 → Pretendard 폰트 파일 이름 매핑
const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'Pretendard-Regular',
  '200': 'Pretendard-Regular',
  '300': 'Pretendard-Regular',
  '400': 'Pretendard-Regular',
  normal: 'Pretendard-Regular',
  '500': 'Pretendard-Medium',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold',
  '800': 'Pretendard-Bold',
  '900': 'Pretendard-Bold',
  bold: 'Pretendard-Bold',
};

export default function Text(props: TextProps) {
  // 전달된 스타일을 하나로 합쳐 글자 굵기를 읽습니다.
  const flat = StyleSheet.flatten(props.style) || {};
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const family = WEIGHT_TO_FAMILY[weight] ?? 'Pretendard-Regular';

  // Pretendard 글꼴을 먼저 깔고, 원래 스타일을 덮어씌웁니다.
  // (굵기는 이미 폰트 파일로 반영되므로 fontWeight는 비워 중복 적용을 막습니다.)
  return <RNText {...props} style={[{ fontFamily: family }, props.style, { fontWeight: undefined }]} />;
}
