import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { collection, getDocs, query, where, doc, onSnapshot, getFunctions, httpsCallable, auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from './cloudflareClient';

const GOLD = '#E4C879';
const BG = '#17231B';
const CARD = '#20372A';
const WHITE = '#FFF8E8';
const MUTED = '#D0C9B5';

export default function FormalLearning({ user, role, onBack, onSettings, onOpenLesson }) {
  const [courses, setCourses] = useState([]);
  const [publishedLessons, setPublishedLessons] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [selected, setSelected] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passPercent, setPassPercent] = useState('70');
  const [selectedLessonIds, setSelectedLessonIds] = useState([]);
  const [questionsJson, setQuestionsJson] = useState('[\n  {"question":"د ازموینې پوښتنه ولیکئ","options":["لومړی ځواب","دویم ځواب","درېیم ځواب","څلورم ځواب"],"correctIndex":0}\n]');
  const [answers, setAnswers] = useState({});
  const isAdmin = ['superadmin', 'admin'].includes(role);
  const functions = getFunctions();
  const call = name => httpsCallable(functions, name);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const [courseSnap, lessonSnap] = await Promise.all([
          getDocs(query(collection(db, 'formalCourses'), where('published', '==', true))),
          getDocs(collection(db, 'publishedLessons'))
        ]);
        setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPublishedLessons(lessonSnap.docs.map(d => ({ id: d.id, ...(d.data().item || {}) })));
      } catch (e) { setMessage(`د کورسونو لوستل ناکام شول: ${e.message || e}`); }
      finally { setLoading(false); }
    })();
    if (user) unsub = onSnapshot(query(collection(db, 'courseEnrollments'), where('uid', '==', user.uid)), snap => {
      const next = {}; snap.docs.forEach(d => { const v = d.data(); next[v.courseId] = { id: d.id, ...v }; }); setEnrollments(next);
    }, e => setMessage(`د زده کړې پرمختګ ونه لوستل شو: ${e.message || e}`));
    return () => unsub();
  }, [user?.uid]);

  async function registerStudent() {
    if (!studentEmail.trim() || studentPassword.length < 8) { setMessage('معتبر ایمیل او لږ تر لږه ۸ توري پاسورډ ولیکئ.'); return; }
    setBusy(true); setMessage('');
    try {
      const credential = await createUserWithEmailAndPassword(auth, studentEmail.trim(), studentPassword);
      await signOut(auth);
      setStudentPassword('');
      setMessage('د زده‌کوونکي حساب جوړ شو. اوس د خپل ایمیل او پاسورډ له لارې ننوتل وکړئ.');
    } catch (e) { setMessage(e.message || 'د زده کوونکي حساب جوړ نه شو.'); }
    finally { setBusy(false); }
  }
  async function loginStudent() {
    if (!studentEmail.trim() || !studentPassword) { setMessage('ایمیل او پاسورډ ولیکئ.'); return; }
    setBusy(true); setMessage('');
    try {
      const credential = await signInWithEmailAndPassword(auth, studentEmail.trim(), studentPassword);
      await credential.user.getIdToken(true); setStudentPassword(''); setMessage('رسمي زده‌کوونکي حساب ته ننوتل بریالي شول.');
    } catch (e) { setMessage(e.message || 'ننوتل ناکام شول.'); }
    finally { setBusy(false); }
  }

  async function refreshCourses() {
    const snap = await getDocs(query(collection(db, 'formalCourses'), where('published', '==', true)));
    setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }
  async function enroll(course) {
    if (!user) { Alert.alert('رسمي زده کړه', 'د رسمي کورس لپاره لومړی د ایمیل او پاسورډ له لارې حساب جوړ او ننوتل وکړئ.', [{ text: 'تنظیمات', onPress: onSettings }, { text: 'بېرته' }]); return; }
    setBusy(true); setMessage('');
    try { await call('enrollFormalCourse')({ courseId: course.id }); setMessage('په رسمي کورس کې ثبت شوئ.'); }
    catch (e) { setMessage(e.message || 'ثبت ناکام شو.'); }
    finally { setBusy(false); }
  }
  async function completeLesson(course, lessonId) {
    setBusy(true); setMessage('');
    try { await call('completeFormalLesson')({ courseId: course.id, lessonId }); setMessage('د درس بشپړېدل ثبت شول.'); }
    catch (e) { setMessage(e.message || 'د درس ثبت ناکام شو.'); }
    finally { setBusy(false); }
  }
  async function submitExam(course) {
    const questions = Array.isArray(course.examQuestions) ? course.examQuestions : [];
    const missing = questions.some((q, i) => !Number.isInteger(answers[i]));
    if (missing) { setMessage('مهرباني وکړئ ټولو پوښتنو ته ځواب ورکړئ.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await call('submitFormalExam')({ courseId: course.id, answers: questions.map((_, i) => answers[i]) });
      if (result.data?.passed) setCertificate(result.data.certificate);
      setMessage(`ستاسې نمرې: ${result.data.score}% — ${result.data.passed ? 'ازموینه مو بریالۍ کړه.' : 'دا ځل بریالي نه شوئ؛ بیا هڅه کولای شئ.'}`);
    } catch (e) { setMessage(e.message || 'ازموینه ثبت نه شوه.'); }
    finally { setBusy(false); }
  }
  async function createCourse() {
    if (!title.trim() || selectedLessonIds.length === 0) { setMessage('د کورس نوم او لږ تر لږه یو تایید شوی درس وټاکئ.'); return; }
    let examQuestions;
    try { examQuestions = JSON.parse(questionsJson); } catch (_) { setMessage('د ازموینې پوښتنې سم JSON نه دي.'); return; }
    setBusy(true); setMessage('');
    try {
      await call('saveFormalCourse')({ title: title.trim(), description: description.trim(), passPercent: Number(passPercent), lessonIds: selectedLessonIds, examQuestions, published: true });
      setTitle(''); setDescription(''); setSelectedLessonIds([]); await refreshCourses(); setMessage('رسمي کورس جوړ او خپور شو.');
    } catch (e) { setMessage(e.message || 'کورس جوړ نه شو.'); }
    finally { setBusy(false); }
  }
  const currentEnrollment = selected ? enrollments[selected.id] : null;
  const selectedLessons = useMemo(() => selected ? (selected.lessonIds || []).map(id => publishedLessons.find(x => x.id === id)).filter(Boolean) : [], [selected, publishedLessons]);
  const done = currentEnrollment?.completedLessonIds || [];
  const questions = selected?.examQuestions || [];

  return <View style={s.root}>
    <View style={s.header}><TouchableOpacity onPress={onBack}><Text style={s.back}>‹ بېرته</Text></TouchableOpacity><Text style={s.heading}>رسمي زده کړې او سند</Text></View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.intro}>دا برخه د ثبت شوي ایمیل حساب لرونکو رسمي زده‌کوونکو لپاره ده. د کورس ټول درسونه بشپړ کړئ، وروستۍ ازموینه پاس کړئ او بیا خپل ډیجیټلي سند ترلاسه کړئ.</Text>
      {!user && <View style={s.card}>
        <Text style={s.text}>د رسمي زده کړو لپاره خپل ایمیل او لږ تر لږه ۸ توري پاسورډ ثبت کړئ. بې له حسابه کاروونکي د عام کتابتون آډیو او PDF کارولی شي.</Text>
        <TextInput style={s.input} autoCapitalize="none" keyboardType="email-address" placeholder="ایمیل" placeholderTextColor={MUTED} value={studentEmail} onChangeText={setStudentEmail}/>
        <TextInput style={s.input} secureTextEntry placeholder="پاسورډ (لږ تر لږه ۸ توري)" placeholderTextColor={MUTED} value={studentPassword} onChangeText={setStudentPassword}/>
        <Action title="نوی رسمي حساب جوړول" onPress={registerStudent} disabled={busy}/>
        <Action title="موجود حساب ته ننوتل" onPress={loginStudent} disabled={busy}/>
      </View>}
      {user && !user.emailVerified && <View style={s.card}>
        <Text style={s.text}>د رسمي کورس لپاره ثبت شوی حساب اړین دی.</Text>
        <Text style={s.muted}>د حساب ننوتل د ایمیل او پاسورډ له لارې دي؛ د ایمیل تایید خدمت لا نه دی فعال.</Text>
      </View>}
      {!!message && <Text style={s.message}>{message}</Text>}
      {loading ? <ActivityIndicator color={GOLD} size="large"/> : selected ? <>
        <View style={s.card}><Text style={s.title}>{selected.title}</Text><Text style={s.text}>{selected.description || 'رسمي علمي کورس'}</Text><Text style={s.muted}>د بریا حد: {selected.passPercent || 70}% · درسونه: {selectedLessons.length}</Text>
          {!currentEnrollment ? <Action title="په کورس کې ثبت نام" onPress={() => enroll(selected)} disabled={!user || busy}/> : <>
            <Text style={s.progress}>بشپړ شوي درسونه: {done.length}/{selectedLessons.length}</Text>
            {selectedLessons.map((lesson, i) => <View key={lesson.id} style={s.lesson}><View style={{flex:1}}><Text style={s.text}>{i+1}. {lesson.title || 'بې نومه درس'}</Text><Text style={s.muted}>{lesson.audio ? 'آډیو' : ''}{lesson.audio && lesson.pdf ? ' · ' : ''}{lesson.pdf ? 'PDF' : ''}</Text></View><Action small title={done.includes(lesson.id) ? 'بشپړ شو ✓' : 'درس پرانیزه'} onPress={() => onOpenLesson(lesson)} disabled={done.includes(lesson.id) || busy}/><Action small title="بشپړ مې کړ" onPress={() => completeLesson(selected, lesson.id)} disabled={done.includes(lesson.id) || busy}/></View>)}
            {done.length === selectedLessons.length && <>
              <Text style={s.title}>وروستۍ ازموینه</Text>
              {questions.map((q, i) => <View key={q.id || i} style={s.question}><Text style={s.text}>{i+1}. {q.question}</Text>{(q.options || []).map((option, j) => <TouchableOpacity key={j} style={[s.option, answers[i] === j && s.optionSelected]} onPress={() => setAnswers(old => ({...old, [i]:j}))}><Text style={s.text}>{String.fromCharCode(65+j)}. {option}</Text></TouchableOpacity>)}</View>)}
              <Action title="ازموینه وسپاره" onPress={() => submitExam(selected)} disabled={busy || questions.length === 0}/>
            </>}
          </>}
        </View>
        <Action title="د کورسونو لېست ته ستنېدل" onPress={() => {setSelected(null); setAnswers({}); setCertificate(null);}}/>
        {certificate && <View style={s.certificate}><Text style={s.certTitle}>د زده کړې د بشپړېدو سند</Text><Text style={s.text}>دا تصدیق کېږي چې {certificate.studentName || user?.email} د «{certificate.courseTitle}» کورس ټول درسونه بشپړ کړي او وروستۍ ازموینه یې بریالۍ کړې ده.</Text><Text style={s.certId}>د سند شمېره: {certificate.certificateId}</Text><Action title="سند شریک کړئ" onPress={() => Share.share({message:`د زده کړې سند\nزده‌کوونکی: ${certificate.studentName || user?.email}\nکورس: ${certificate.courseTitle}\nنمرې: ${certificate.score}%\nد سند شمېره: ${certificate.certificateId}\nد تصدیق کوډ: ${certificate.verificationCode}`})}/></View>}
      </> : <>
        <Text style={s.section}>خپر شوي رسمي کورسونه</Text>
        {courses.map(course => <TouchableOpacity key={course.id} style={s.card} onPress={() => {setSelected(course);setAnswers({});setCertificate(null);}}><Text style={s.title}>{course.title}</Text><Text style={s.text}>{course.description || 'د کورس تفصیل نشته.'}</Text><Text style={s.muted}>{(course.lessonIds || []).length} درسونه · د بریا حد {course.passPercent || 70}% {enrollments[course.id] ? '· ثبت شوی' : ''}</Text></TouchableOpacity>)}
        {courses.length === 0 && <Text style={s.muted}>اوس مهال رسمي کورس نه دی خپور شوی.</Text>}
        {isAdmin && <View style={s.card}><Text style={s.title}>د اډمین لپاره: نوی رسمي کورس</Text><TextInput style={s.input} placeholder="د کورس نوم" placeholderTextColor={MUTED} value={title} onChangeText={setTitle}/><TextInput style={[s.input,{minHeight:70}]} multiline placeholder="د کورس لنډ معلومات" placeholderTextColor={MUTED} value={description} onChangeText={setDescription}/><TextInput style={s.input} keyboardType="number-pad" placeholder="د بریا سلنه (لکه 70)" placeholderTextColor={MUTED} value={passPercent} onChangeText={setPassPercent}/><Text style={s.text}>له تایید شویو درسونو څخه انتخاب کړئ:</Text>{publishedLessons.map(lesson => <TouchableOpacity key={lesson.id} style={s.lesson} onPress={() => setSelectedLessonIds(old => old.includes(lesson.id) ? old.filter(x=>x!==lesson.id) : [...old,lesson.id])}><Text style={s.text}>{selectedLessonIds.includes(lesson.id) ? '☑' : '□'} {lesson.title || lesson.id}</Text></TouchableOpacity>)}<Text style={s.text}>د ازموینې پوښتنې (JSON):</Text><TextInput style={[s.input,{minHeight:150,fontFamily:'monospace'}]} multiline value={questionsJson} onChangeText={setQuestionsJson}/><Action title="کورس جوړ او خپور کړه" onPress={createCourse} disabled={busy}/></View>}
      </>}
    </ScrollView>
    {busy && <View style={s.busy}><ActivityIndicator color={GOLD}/></View>}
  </View>;
}
function Action({title,onPress,disabled,small}) { return <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.action,small&&{paddingVertical:7,paddingHorizontal:9},disabled&&{opacity:.45}]}><Text style={s.actionText}>{title}</Text></TouchableOpacity>; }
const s=StyleSheet.create({root:{flex:1,backgroundColor:BG},header:{padding:16,borderBottomWidth:1,borderColor:'#718052',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},back:{color:GOLD,fontSize:16},heading:{color:GOLD,fontSize:19,fontWeight:'bold'},content:{padding:14,gap:12},intro:{color:MUTED,lineHeight:24,textAlign:'right'},card:{backgroundColor:CARD,borderRadius:12,padding:14,marginBottom:10,gap:9},title:{color:GOLD,fontSize:18,fontWeight:'bold',textAlign:'right'},text:{color:WHITE,fontSize:14,textAlign:'right',lineHeight:22},muted:{color:MUTED,fontSize:12,textAlign:'right'},message:{color:GOLD,textAlign:'right',padding:8},section:{color:GOLD,fontSize:17,fontWeight:'bold',textAlign:'right'},action:{backgroundColor:'#3D704D',padding:12,borderRadius:9,alignItems:'center',marginTop:6},actionText:{color:WHITE,fontWeight:'bold'},progress:{color:GOLD,textAlign:'right',fontWeight:'bold'},lesson:{flexDirection:'row-reverse',alignItems:'center',gap:7,paddingVertical:8,borderBottomWidth:1,borderColor:'#526044'},question:{paddingVertical:10,gap:7},option:{padding:9,borderWidth:1,borderColor:'#718052',borderRadius:8},optionSelected:{backgroundColor:'#35583E'},input:{backgroundColor:'#17231B',color:WHITE,borderWidth:1,borderColor:'#718052',borderRadius:8,padding:10,textAlign:'right'},certificate:{backgroundColor:'#f7f0d7',padding:18,borderRadius:12,gap:12},certTitle:{color:'#35583E',fontSize:22,fontWeight:'bold',textAlign:'center'},certId:{color:'#35583E',textAlign:'center',fontWeight:'bold'},busy:{position:'absolute',bottom:20,alignSelf:'center',backgroundColor:CARD,padding:12,borderRadius:30}});
