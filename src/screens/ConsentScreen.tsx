import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { colors, radius } from '../theme';

// 로그인 직후 보여주는 약관·개인정보 동의 화면입니다.
// 얼굴 사진(생체정보)을 다루는 서비스라, 사용 전에 동의를 받고 그 동의를 서버에 기록합니다.
// onAgree(marketing): 필수 항목에 모두 동의하고 "시작하기"를 누르면 호출됩니다. (marketing=선택 동의 여부)

type Props = { onAgree: (marketing: boolean) => void };

// 약관/개인정보 본문 (기본안 — 정식 출시 전 법률 검토가 필요합니다)
const TERMS_TEXT = `제1조(목적)
본 약관은 HeOnn FaceFit(이하 "서비스")의 이용 조건과 절차, 회사와 이용자의 권리·의무를 규정합니다.

제2조(서비스 내용)
서비스는 얼굴 사진을 분석해 비대칭·부기·피부 상태 등을 추정하고, 온열 유기(방짜유기) 괄사 케어 가이드와 맞춤 추천을 제공합니다.

제3조(분석 결과의 성격)
분석 점수와 추정값(나이·다크서클·주름 등)은 참고용이며, 의학적 진단이나 치료 효과를 보장하지 않습니다.

제4조(이용자의 의무)
이용자는 본인의 얼굴 사진만 업로드해야 하며, 타인의 사진을 무단으로 사용할 수 없습니다.`;

const PRIVACY_TEXT = `1. 수집하는 개인정보 항목
- 계정 정보: 소셜 로그인 식별값, 닉네임
- 얼굴 사진 및 분석 결과(생체정보에 해당)

2. 수집·이용 목적
- 얼굴 분석, 케어 가이드·맞춤 추천 제공
- 사용 기록(Before/After) 저장 및 변화 추적

3. 보유·이용 기간
- 회원 탈퇴 또는 삭제 요청 시까지 보관하며, 이후 지체 없이 파기합니다.

4. 제3자 제공
- 원칙적으로 제3자에게 제공하지 않습니다.

5. 동의 거부 권리
- 동의를 거부할 수 있으나, 필수 항목 미동의 시 서비스 이용이 제한됩니다.

※ 본 내용은 기본 안내이며, 정식 서비스 시 관련 법령에 따른 최종 방침이 적용됩니다.`;

export default function ConsentScreen({ onAgree }: Props) {
  const [terms, setTerms] = useState(false); // [필수] 이용약관
  const [privacy, setPrivacy] = useState(false); // [필수] 개인정보(얼굴) 수집·이용
  const [marketing, setMarketing] = useState(false); // [선택] 마케팅 수신
  const [viewer, setViewer] = useState<null | 'terms' | 'privacy'>(null); // 본문 보기 팝업

  const allRequired = terms && privacy; // 필수 둘 다 동의해야 시작 가능
  const allChecked = terms && privacy && marketing;

  // "전체 동의": 모두 켜져 있으면 모두 끄고, 아니면 모두 켭니다.
  function toggleAll() {
    const next = !allChecked;
    setTerms(next);
    setPrivacy(next);
    setMarketing(next);
  }

  // 체크 표시 동그라미
  function Check({ on }: { on: boolean }) {
    return (
      <View style={[styles.check, on && styles.checkOn]}>
        {on && <Feather name="check" size={14} color={colors.bg} />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={styles.head}>
          <Text style={styles.brand}>HeOnn FaceFit</Text>
          <Text style={styles.title}>시작하기 전에 동의가 필요해요</Text>
          <Text style={styles.sub}>
            얼굴 사진을 분석하는 서비스라, 안전한 이용을 위해 아래 내용에 동의해 주세요.
          </Text>
        </View>

        {/* 전체 동의 */}
        <Pressable style={styles.allRow} onPress={toggleAll}>
          <Check on={allChecked} />
          <Text style={styles.allText}>약관에 모두 동의합니다</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* [필수] 이용약관 */}
        <View style={styles.itemRow}>
          <Pressable style={styles.itemLeft} onPress={() => setTerms((v) => !v)}>
            <Check on={terms} />
            <Text style={styles.itemText}>
              <Text style={styles.req}>[필수] </Text>서비스 이용약관 동의
            </Text>
          </Pressable>
          <Pressable onPress={() => setViewer('terms')} hitSlop={8}>
            <Text style={styles.viewLink}>보기</Text>
          </Pressable>
        </View>

        {/* [필수] 개인정보(얼굴) */}
        <View style={styles.itemRow}>
          <Pressable style={styles.itemLeft} onPress={() => setPrivacy((v) => !v)}>
            <Check on={privacy} />
            <Text style={styles.itemText}>
              <Text style={styles.req}>[필수] </Text>개인정보 수집·이용 동의{'\n'}
              <Text style={styles.itemNote}>얼굴 사진(생체정보) 포함</Text>
            </Text>
          </Pressable>
          <Pressable onPress={() => setViewer('privacy')} hitSlop={8}>
            <Text style={styles.viewLink}>보기</Text>
          </Pressable>
        </View>

        {/* [선택] 마케팅 */}
        <View style={styles.itemRow}>
          <Pressable style={styles.itemLeft} onPress={() => setMarketing((v) => !v)}>
            <Check on={marketing} />
            <Text style={styles.itemText}>
              <Text style={styles.opt}>[선택] </Text>마케팅 정보 수신 동의
            </Text>
          </Pressable>
        </View>

        <Text style={styles.hint}>필수 항목에 동의해야 서비스를 이용할 수 있어요.</Text>
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.startBtn, !allRequired && styles.startBtnDisabled]}
          onPress={() => allRequired && onAgree(marketing)}
          disabled={!allRequired}
        >
          <Text style={[styles.startBtnText, !allRequired && styles.startBtnTextDisabled]}>
            동의하고 시작하기
          </Text>
        </Pressable>
      </View>

      {/* 약관/개인정보 본문 보기 팝업 */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setViewer(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {viewer === 'terms' ? '서비스 이용약관' : '개인정보 수집·이용'}
              </Text>
              <Pressable onPress={() => setViewer(null)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>{viewer === 'terms' ? TERMS_TEXT : PRIVACY_TEXT}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingBottom: 24 },
  head: { marginTop: 24, marginBottom: 28 },
  brand: { color: colors.amber400, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700', marginTop: 10 },
  sub: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    padding: 16,
  },
  allText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  itemText: { color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 },
  itemNote: { color: colors.textFaint, fontSize: 12 },
  req: { color: colors.amber400, fontWeight: '700' },
  opt: { color: colors.textMuted, fontWeight: '700' },
  viewLink: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOn: { backgroundColor: colors.amber500, borderColor: colors.amber500 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 16, textAlign: 'center' },
  footer: {
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  startBtn: {
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.amber500,
    alignItems: 'center',
  },
  startBtnDisabled: { backgroundColor: colors.surface2 },
  startBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  startBtnTextDisabled: { color: colors.textFaint },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  modalBody: { flexGrow: 0 },
  modalText: { color: colors.textMuted, fontSize: 13, lineHeight: 21 },
});
