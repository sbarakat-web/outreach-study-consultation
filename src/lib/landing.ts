import type { Lang } from "./i18n";

type Pair = readonly [string, string];

interface LandingContent {
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  heroCta: string;
  applicationLabel: string;
  supportEyebrow: string;
  supportTitle: string;
  supportCards: readonly Pair[];
  coursesEyebrow: string;
  coursesTitle: string;
  coursesText: string;
  englishLabel: string;
  englishTitle: string;
  englishText: string;
  courseOptions: (count: number) => string;
  degreeOptions: string;
  programmeCount: (count: number) => string;
  chooseProgramme: string;
  whyEyebrow: string;
  whyTitle: string;
  whyCards: readonly Pair[];
  processEyebrow: string;
  processTitle: string;
  processCards: readonly Pair[];
  partnersEyebrow: string;
  partnersTitle: string;
  partnersText: string;
  logoAlt: (name: string) => string;
  faqEyebrow: string;
  faqTitle: string;
  faqs: readonly Pair[];
  finalTitle: string;
  finalText: string;
  finalCta: string;
}

const CONTENT: Record<Lang, LandingContent> = {
  en: {
    heroEyebrow: "Free study consultation",
    heroTitle: "Study in Malta with clear, personal guidance",
    heroText: "Compare English courses, diploma, bachelor’s and master’s programmes, tuition fees and entry requirements. Our advisers help you choose the right route and prepare your next steps.",
    heroCta: "Find my programme",
    applicationLabel: "Study in Malta application",
    supportEyebrow: "Support from first choice to application",
    supportTitle: "Plan your studies in Malta with confidence",
    supportCards: [
      ["Courses and fees", "Compare Malta programmes, providers, duration and tuition fees in one clear journey."],
      ["Application support", "Get guidance on entry requirements, documents, intakes and your school application."],
      ["Visa preparation", "Understand the Malta student visa checklist and prepare the required documents step by step."],
    ],
    coursesEyebrow: "Courses in Malta",
    coursesTitle: "English and higher-education programmes",
    coursesText: "Compare course duration, institution, qualification, tuition fees and entry requirements before choosing. Final availability and admission are confirmed by the institution.",
    englishLabel: "English language",
    englishTitle: "English courses in Malta and online",
    englishText: "General English, academic English, business English, intensive and one-to-one options from multiple providers.",
    courseOptions: (count) => `${count} course options`,
    degreeOptions: "Diploma, bachelor’s and master’s options where available.",
    programmeCount: (count) => `${count} programme${count === 1 ? "" : "s"}`,
    chooseProgramme: "Choose a programme and apply →",
    whyEyebrow: "Why Malta?",
    whyTitle: "An English-speaking study destination in Europe",
    whyCards: [
      ["English-speaking", "English is an official language and is widely used in education and daily life."],
      ["European location", "Study in a Mediterranean country that is part of the European Union and Schengen Area."],
      ["Different study levels", "Explore language study, diplomas, bachelor’s degrees and postgraduate programmes."],
      ["Personal guidance", "Compare realistic options for your profile, budget, English level and preferred intake."],
    ],
    processEyebrow: "How it works",
    processTitle: "Your Malta study application journey",
    processCards: [
      ["Choose", "Select your English level and the course that interests you."],
      ["Consult", "Book a free call so an adviser can review your goals and eligibility."],
      ["Prepare", "Upload the requested academic, identity and English-language documents."],
      ["Apply", "Confirm the programme and continue with the institution and visa preparation steps."],
    ],
    partnersEyebrow: "Institutions and providers",
    partnersTitle: "Explore study options from our listed partners",
    partnersText: "Programme availability depends on your profile, intake and current admissions conditions.",
    logoAlt: (name) => `${name} logo`,
    faqEyebrow: "Frequently asked questions",
    faqTitle: "Studying in Malta",
    faqs: [
      ["What can I study in Malta?", "You can compare English-language courses and diploma, bachelor’s and master’s programmes in business, accountancy, health and social care, information technology, tourism and hospitality, and logistics."],
      ["How much does it cost to study in Malta?", "Tuition depends on the institution, course and duration. The programme selector shows current guidance prices, and your adviser will confirm the final fee, payment schedule and any available scholarship before enrolment."],
      ["Do I need IELTS to study in Malta?", "English requirements depend on the programme. Some courses accept a school assessment, while others require an IELTS score or equivalent evidence. Your adviser will check the requirement for the exact course you select."],
      ["What documents are needed for an application?", "Typical documents include your passport bio page, an updated Europass CV, academic certificates and transcripts, IELTS if available, and a 300-word personal statement. Requirements can vary by institution."],
      ["Can Outreach help with the Malta student visa process?", "Outreach provides document and process guidance, including access to the official student national visa checklist. Visa decisions are made only by the relevant Maltese authorities."],
      ["How do I start?", "Choose your English level, select a course, submit the short form and book a free consultation from your personal dashboard."],
    ],
    finalTitle: "Ready to find your programme in Malta?",
    finalText: "Start with your English level and course preference. Your personal dashboard will guide you through the consultation, documents and next steps.",
    finalCta: "Start my free consultation",
  },
  fr: {
    heroEyebrow: "Consultation d’études gratuite",
    heroTitle: "Étudiez à Malte avec un accompagnement clair et personnalisé",
    heroText: "Comparez les cours d’anglais, les diplômes, les licences et les masters, ainsi que les frais de scolarité et les conditions d’admission. Nos conseillers vous aident à choisir le bon parcours et à préparer la suite.",
    heroCta: "Trouver mon programme",
    applicationLabel: "Candidature pour étudier à Malte",
    supportEyebrow: "Un accompagnement du premier choix à la candidature",
    supportTitle: "Planifiez vos études à Malte en toute confiance",
    supportCards: [
      ["Cours et tarifs", "Comparez clairement les programmes, établissements, durées et frais de scolarité à Malte."],
      ["Aide à la candidature", "Obtenez des conseils sur les conditions d’admission, les documents, les rentrées et votre candidature."],
      ["Préparation du visa", "Comprenez la liste des documents du visa étudiant maltais et préparez-les étape par étape."],
    ],
    coursesEyebrow: "Formations à Malte",
    coursesTitle: "Cours d’anglais et études supérieures",
    coursesText: "Comparez la durée, l’établissement, le diplôme, les frais et les conditions d’admission. La disponibilité et l’admission définitives sont confirmées par l’établissement.",
    englishLabel: "Langue anglaise",
    englishTitle: "Cours d’anglais à Malte et en ligne",
    englishText: "Anglais général, académique, professionnel, intensif et cours individuels auprès de plusieurs établissements.",
    courseOptions: (count) => `${count} options de cours`,
    degreeOptions: "Diplômes, licences et masters selon les disponibilités.",
    programmeCount: (count) => `${count} programme${count > 1 ? "s" : ""}`,
    chooseProgramme: "Choisir un programme et postuler →",
    whyEyebrow: "Pourquoi Malte ?",
    whyTitle: "Une destination d’études anglophone en Europe",
    whyCards: [
      ["Pays anglophone", "L’anglais est une langue officielle, largement utilisée dans l’enseignement et la vie quotidienne."],
      ["Situation européenne", "Étudiez dans un pays méditerranéen membre de l’Union européenne et de l’espace Schengen."],
      ["Plusieurs niveaux d’études", "Découvrez des cours de langue, diplômes, licences et formations de troisième cycle."],
      ["Conseils personnalisés", "Comparez des options réalistes selon votre profil, budget, niveau d’anglais et rentrée souhaitée."],
    ],
    processEyebrow: "Comment ça marche",
    processTitle: "Votre parcours de candidature à Malte",
    processCards: [
      ["Choisir", "Indiquez votre niveau d’anglais et la formation qui vous intéresse."],
      ["Consulter", "Réservez un appel gratuit pour faire le point sur vos objectifs et votre admissibilité."],
      ["Préparer", "Envoyez les documents scolaires, d’identité et de langue anglaise demandés."],
      ["Postuler", "Confirmez le programme puis poursuivez avec l’établissement et la préparation du visa."],
    ],
    partnersEyebrow: "Établissements et prestataires",
    partnersTitle: "Découvrez les formations proposées par nos partenaires référencés",
    partnersText: "La disponibilité dépend de votre profil, de la rentrée et des conditions d’admission en vigueur.",
    logoAlt: (name) => `Logo de ${name}`,
    faqEyebrow: "Questions fréquentes",
    faqTitle: "Étudier à Malte",
    faqs: [
      ["Que puis-je étudier à Malte ?", "Vous pouvez comparer des cours d’anglais et des diplômes, licences et masters en commerce, comptabilité, santé et services sociaux, informatique, tourisme, hôtellerie et logistique."],
      ["Combien coûtent les études à Malte ?", "Les frais dépendent de l’établissement, de la formation et de sa durée. Le sélecteur affiche des prix indicatifs et votre conseiller confirmera le tarif final, l’échéancier et les bourses disponibles."],
      ["Ai-je besoin de l’IELTS pour étudier à Malte ?", "Les exigences varient selon le programme. Certains acceptent une évaluation de l’école, d’autres demandent l’IELTS ou une preuve équivalente. Votre conseiller vérifiera la formation choisie."],
      ["Quels documents faut-il pour candidater ?", "Il faut généralement la page d’identité du passeport, un CV Europass à jour, les diplômes et relevés de notes, l’IELTS si disponible et une lettre personnelle de 300 mots. Les exigences varient selon l’établissement."],
      ["Outreach peut-il m’aider pour le visa étudiant maltais ?", "Outreach vous guide pour les documents et les démarches, notamment avec la liste officielle du visa étudiant national. La décision appartient uniquement aux autorités maltaises compétentes."],
      ["Comment commencer ?", "Indiquez votre niveau d’anglais, choisissez une formation, envoyez le formulaire puis réservez une consultation gratuite depuis votre espace personnel."],
    ],
    finalTitle: "Prêt à trouver votre programme à Malte ?",
    finalText: "Commencez par votre niveau d’anglais et votre préférence de formation. Votre espace personnel vous guidera pour la consultation, les documents et les prochaines étapes.",
    finalCta: "Commencer ma consultation gratuite",
  },
  es: {
    heroEyebrow: "Consulta de estudios gratuita",
    heroTitle: "Estudia en Malta con orientación clara y personalizada",
    heroText: "Compara cursos de inglés, diplomas, grados y másteres, matrículas y requisitos de acceso. Nuestros asesores te ayudan a elegir el camino adecuado y preparar los próximos pasos.",
    heroCta: "Encontrar mi programa",
    applicationLabel: "Solicitud para estudiar en Malta",
    supportEyebrow: "Apoyo desde la primera elección hasta la solicitud",
    supportTitle: "Planifica tus estudios en Malta con confianza",
    supportCards: [
      ["Cursos y precios", "Compara programas, centros, duración y matrículas en Malta de forma clara."],
      ["Apoyo con la solicitud", "Recibe orientación sobre requisitos, documentos, convocatorias y la solicitud al centro."],
      ["Preparación del visado", "Conoce la lista del visado de estudiante de Malta y prepara los documentos paso a paso."],
    ],
    coursesEyebrow: "Cursos en Malta",
    coursesTitle: "Inglés y programas de educación superior",
    coursesText: "Compara duración, institución, titulación, matrícula y requisitos antes de elegir. La institución confirma la disponibilidad y admisión definitivas.",
    englishLabel: "Lengua inglesa",
    englishTitle: "Cursos de inglés en Malta y en línea",
    englishText: "Inglés general, académico, empresarial, intensivo y clases individuales con distintos proveedores.",
    courseOptions: (count) => `${count} opciones de cursos`,
    degreeOptions: "Diplomas, grados y másteres cuando estén disponibles.",
    programmeCount: (count) => `${count} programa${count === 1 ? "" : "s"}`,
    chooseProgramme: "Elegir un programa y solicitar →",
    whyEyebrow: "¿Por qué Malta?",
    whyTitle: "Un destino europeo de estudios en inglés",
    whyCards: [
      ["País anglófono", "El inglés es idioma oficial y se utiliza ampliamente en la educación y la vida diaria."],
      ["Ubicación europea", "Estudia en un país mediterráneo de la Unión Europea y del espacio Schengen."],
      ["Distintos niveles", "Explora cursos de idiomas, diplomas, grados y programas de posgrado."],
      ["Orientación personal", "Compara opciones realistas para tu perfil, presupuesto, nivel de inglés y fecha de inicio."],
    ],
    processEyebrow: "Cómo funciona",
    processTitle: "Tu proceso de solicitud para estudiar en Malta",
    processCards: [
      ["Elegir", "Selecciona tu nivel de inglés y el curso que te interesa."],
      ["Consultar", "Reserva una llamada gratuita para revisar tus objetivos y requisitos."],
      ["Preparar", "Sube los documentos académicos, de identidad y de inglés solicitados."],
      ["Solicitar", "Confirma el programa y continúa con la institución y la preparación del visado."],
    ],
    partnersEyebrow: "Instituciones y proveedores",
    partnersTitle: "Explora las opciones de nuestros socios",
    partnersText: "La disponibilidad depende de tu perfil, la convocatoria y las condiciones de admisión vigentes.",
    logoAlt: (name) => `Logotipo de ${name}`,
    faqEyebrow: "Preguntas frecuentes",
    faqTitle: "Estudiar en Malta",
    faqs: [
      ["¿Qué puedo estudiar en Malta?", "Puedes comparar cursos de inglés y diplomas, grados y másteres en negocios, contabilidad, salud y atención social, informática, turismo, hostelería y logística."],
      ["¿Cuánto cuesta estudiar en Malta?", "La matrícula depende de la institución, el curso y la duración. El selector muestra precios orientativos y tu asesor confirmará el precio final, el calendario de pagos y las becas disponibles."],
      ["¿Necesito IELTS para estudiar en Malta?", "Los requisitos de inglés dependen del programa. Algunos aceptan una evaluación del centro y otros exigen IELTS o una prueba equivalente. Tu asesor comprobará el curso exacto."],
      ["¿Qué documentos necesito para solicitar?", "Normalmente se requiere la página de datos del pasaporte, un CV Europass actualizado, certificados y notas académicas, IELTS si lo tienes y una declaración personal de 300 palabras. Puede variar según la institución."],
      ["¿Puede Outreach ayudarme con el visado de estudiante?", "Outreach orienta sobre documentos y procesos, incluida la lista oficial del visado nacional de estudiante. La decisión corresponde únicamente a las autoridades maltesas competentes."],
      ["¿Cómo empiezo?", "Indica tu nivel de inglés, elige un curso, envía el formulario y reserva una consulta gratuita desde tu panel personal."],
    ],
    finalTitle: "¿Listo para encontrar tu programa en Malta?",
    finalText: "Empieza con tu nivel de inglés y el curso que prefieres. Tu panel personal te guiará con la consulta, los documentos y los siguientes pasos.",
    finalCta: "Iniciar mi consulta gratuita",
  },
  ar: {
    heroEyebrow: "استشارة دراسية مجانية",
    heroTitle: "ادرس في مالطا بإرشاد واضح وشخصي",
    heroText: "قارن بين دورات الإنجليزية وبرامج الدبلوم والبكالوريوس والماجستير والرسوم الدراسية وشروط القبول. يساعدك مستشارونا على اختيار المسار المناسب والاستعداد للخطوات التالية.",
    heroCta: "اعثر على برنامجي",
    applicationLabel: "طلب الدراسة في مالطا",
    supportEyebrow: "دعم من الاختيار الأول حتى تقديم الطلب",
    supportTitle: "خطط لدراستك في مالطا بثقة",
    supportCards: [
      ["الدورات والرسوم", "قارن برامج مالطا ومؤسساتها ومددها ورسومها الدراسية في مسار واضح."],
      ["دعم التقديم", "احصل على إرشاد حول شروط القبول والمستندات ومواعيد البدء وطلب الالتحاق."],
      ["الاستعداد للتأشيرة", "تعرّف إلى قائمة متطلبات تأشيرة الطالب في مالطا وجهّز المستندات خطوة بخطوة."],
    ],
    coursesEyebrow: "الدورات في مالطا",
    coursesTitle: "برامج اللغة الإنجليزية والتعليم العالي",
    coursesText: "قارن مدة الدورة والمؤسسة والمؤهل والرسوم وشروط القبول قبل الاختيار. تؤكد المؤسسة التوفر والقبول النهائيين.",
    englishLabel: "اللغة الإنجليزية",
    englishTitle: "دورات الإنجليزية في مالطا وعبر الإنترنت",
    englishText: "الإنجليزية العامة والأكاديمية وإنجليزية الأعمال والدورات المكثفة والفردية لدى عدة مؤسسات.",
    courseOptions: (count) => `${count} خيارات للدورات`,
    degreeOptions: "خيارات الدبلوم والبكالوريوس والماجستير حسب التوفر.",
    programmeCount: (count) => `${count} برامج`,
    chooseProgramme: "اختر برنامجًا وقدّم طلبك ←",
    whyEyebrow: "لماذا مالطا؟",
    whyTitle: "وجهة أوروبية للدراسة باللغة الإنجليزية",
    whyCards: [
      ["بيئة ناطقة بالإنجليزية", "الإنجليزية لغة رسمية وتُستخدم على نطاق واسع في التعليم والحياة اليومية."],
      ["موقع أوروبي", "ادرس في دولة متوسطية عضو في الاتحاد الأوروبي ومنطقة شنغن."],
      ["مستويات دراسية متنوعة", "استكشف دراسة اللغة والدبلومات والبكالوريوس وبرامج الدراسات العليا."],
      ["إرشاد شخصي", "قارن خيارات واقعية تناسب ملفك وميزانيتك ومستواك في الإنجليزية وموعد البدء المفضل."],
    ],
    processEyebrow: "كيف تسير العملية",
    processTitle: "رحلة طلب الدراسة في مالطا",
    processCards: [
      ["اختر", "حدد مستواك في الإنجليزية والدورة التي تهمك."],
      ["استشر", "احجز مكالمة مجانية ليراجع المستشار أهدافك وأهليتك."],
      ["جهّز", "ارفع المستندات الأكاديمية ومستندات الهوية وإثبات اللغة المطلوبة."],
      ["قدّم", "أكد البرنامج وتابع الخطوات مع المؤسسة والاستعداد للتأشيرة."],
    ],
    partnersEyebrow: "المؤسسات ومقدمو البرامج",
    partnersTitle: "استكشف خيارات الدراسة لدى شركائنا المدرجين",
    partnersText: "يعتمد توفر البرامج على ملفك وموعد البدء وشروط القبول الحالية.",
    logoAlt: (name) => `شعار ${name}`,
    faqEyebrow: "الأسئلة الشائعة",
    faqTitle: "الدراسة في مالطا",
    faqs: [
      ["ماذا يمكنني أن أدرس في مالطا؟", "يمكنك مقارنة دورات الإنجليزية وبرامج الدبلوم والبكالوريوس والماجستير في الأعمال والمحاسبة والرعاية الصحية والاجتماعية وتقنية المعلومات والسياحة والضيافة والخدمات اللوجستية."],
      ["كم تبلغ تكلفة الدراسة في مالطا؟", "تعتمد الرسوم على المؤسسة والدورة والمدة. يعرض محدد البرامج أسعارًا إرشادية، ويؤكد مستشارك الرسوم النهائية وجدول الدفع والمنح المتاحة قبل التسجيل."],
      ["هل أحتاج إلى اختبار IELTS للدراسة في مالطا؟", "تعتمد متطلبات الإنجليزية على البرنامج. تقبل بعض الدورات تقييم المؤسسة، بينما تتطلب أخرى IELTS أو إثباتًا مماثلًا. سيتحقق مستشارك من متطلبات الدورة المختارة."],
      ["ما المستندات المطلوبة للتقديم؟", "تشمل المستندات المعتادة صفحة البيانات في جواز السفر وسيرة Europass محدثة والشهادات وكشوف الدرجات وIELTS إن وجد وبيانًا شخصيًا من 300 كلمة. قد تختلف المتطلبات حسب المؤسسة."],
      ["هل تساعد Outreach في إجراءات تأشيرة الطالب؟", "تقدم Outreach إرشادًا حول المستندات والإجراءات، بما في ذلك قائمة تأشيرة الطالب الوطنية الرسمية. وتتخذ السلطات المالطية المختصة وحدها قرارات التأشيرة."],
      ["كيف أبدأ؟", "اختر مستواك في الإنجليزية وحدد دورة وأرسل النموذج القصير ثم احجز استشارة مجانية من لوحة التحكم الشخصية."],
    ],
    finalTitle: "هل أنت مستعد للعثور على برنامجك في مالطا؟",
    finalText: "ابدأ بمستواك في الإنجليزية والدورة التي تفضلها. سترشدك لوحة التحكم الشخصية خلال الاستشارة والمستندات والخطوات التالية.",
    finalCta: "ابدأ استشارتي المجانية",
  },
};

export const landingContent = (lang: Lang) => CONTENT[lang];
