from pathlib import Path
import json, re, html

root=Path(__file__).resolve().parents[2]/'output'
old=(root/'PurePaw_上线前备份_20261110.html').read_text(encoding='utf-8')
sources=json.loads((root/'website_word_sources_20261110.json').read_text(encoding='utf-8-sig'))
products=[('全猫鸡肉',[1.5,3,10],48,'chicken','cat'),('全猫牛肉',[1.5,3,10],48,'beef','cat'),('幼猫鸡肉',[1.5,3,10],51,'chicken','kitten'),('全犬鸡肉',[1.5,5,15],40,'chicken','dog'),('全犬牛肉',[1.5,5,15],48,'beef','dog'),('小犬鸡肉',[1.5,3],40,'chicken','small'),('小犬牛肉',[1.5,3],48,'beef','small')]
for prefix,sizes,pct,meat,kind in products:
    matches=[s for s in sources if s['file'].startswith(prefix)]
    assert len(matches)==len(sizes),(prefix,len(matches))
    for source in matches:
        english=source['text'].split('Ingredients and Feeding Information')[1]
        assert f'{pct}%' in english.split('Amino Acids:')[0],source['file']

# Titles and ingredients are translations of the seven product families in the Word sources.
L={
'en':dict(names=['All-age cat food · Chicken','All-age cat food · Beef','Kitten food · Chicken','All-age dog food · Chicken','All-age dog food · Beef','Small dog food · Chicken','Small dog food · Beef'],ch='Chicken + bone-in chicken',be='Beef + bone-in beef',rest='corn gluten meal, corn, rice, beet pulp, chicken fat.',ing='Ingredients',size='Net weight',detail='View ingredients & sizes',enq='Ask about this product',note='The stated animal-ingredient percentage is the combined amount of meat and bone-in meat. Refer to the product packaging for feeding instructions and the full label.',title='Closer to nature.<br>Nutrition with care.',about='Pets are family. Every meal deserves thoughtful care.',body='PURE PAW takes inspiration from a way of life close to nature, with attention to ingredients, nutrition and everyday feeding. We put care for pets into every choice, every portion and every day together.'),
'zh':dict(names=['全龄猫粮 · 鸡肉','全龄猫粮 · 牛肉','幼猫粮 · 鸡肉','全龄犬粮 · 鸡肉','全龄犬粮 · 牛肉','小型犬粮 · 鸡肉','小型犬粮 · 牛肉'],ch='鸡肉＋带骨鸡肉',be='牛肉＋带骨牛肉',rest='玉米蛋白粉、玉米、大米、甜菜粕、鸡油。',ing='配料',size='净重',detail='查看配料与规格',enq='咨询这款产品',note='动物原料比例指肉与带骨肉两项的合计比例。喂养方法及完整标签信息请参照产品包装。',title='亲近自然，<br>用心滋养。',about='宠物是家人，每一餐都值得用心对待。',body='PURE PAW 从亲近自然的生活方式中汲取灵感，关注原料、营养与日常喂养。我们把对宠物的关爱，融入每一次选择、每一份粮食，以及共同度过的每一天。'),
'ru':dict(names=['Корм для кошек всех возрастов · Курица','Корм для кошек всех возрастов · Говядина','Корм для котят · Курица','Корм для собак всех возрастов · Курица','Корм для собак всех возрастов · Говядина','Корм для собак мелких пород · Курица','Корм для собак мелких пород · Говядина'],ch='Куриное мясо + куриное мясо на кости',be='Говядина + говядина на кости',rest='кукурузный глютен, кукуруза, рис, свекловичный жом, куриный жир.',ing='Ингредиенты',size='Масса нетто',detail='Состав и фасовка',enq='Спросить об этом продукте',note='Доля животных ингредиентов указана суммарно для мяса и мяса на кости. Рекомендации по кормлению и полная информация приведены на упаковке.',title='Ближе к природе —<br>питание с заботой.',about='Питомцы — это семья, и каждый приём пищи заслуживает внимательного отношения.',body='PURE PAW черпает вдохновение в образе жизни, близком к природе, уделяя внимание ингредиентам, питанию и ежедневному кормлению. Мы вкладываем заботу о питомцах в каждый выбор, каждую порцию корма и каждый день, проведённый вместе.'),
'uz':dict(names=['Barcha yoshdagi mushuklar uchun · Tovuq','Barcha yoshdagi mushuklar uchun · Mol go‘shti','Mushukchalar uchun · Tovuq','Barcha yoshdagi itlar uchun · Tovuq','Barcha yoshdagi itlar uchun · Mol go‘shti','Kichik zotli itlar uchun · Tovuq','Kichik zotli itlar uchun · Mol go‘shti'],ch='Tovuq go‘shti + suyakli tovuq go‘shti',be='Mol go‘shti + suyakli mol go‘shti',rest='makkajo‘xori oqsil uni, makkajo‘xori, guruch, lavlagi pulpasi, tovuq yog‘i.',ing='Ingredientlar',size='Sof og‘irligi',detail='Tarkibi va qadoq hajmi',enq='Mahsulot haqida so‘rash',note='Hayvon xomashyosi ulushi go‘sht va suyakli go‘shtning jami ulushidir. Oziqlantirish ko‘rsatmalari va to‘liq ma’lumot uchun qadoqqa qarang.',title='Tabiatga yaqin —<br>g‘amxo‘rlik bilan oziqlantirish.',about='Uy hayvonlari — oila a’zolari. Har bir taom e’tiborga loyiq.',body='PURE PAW tabiatga yaqin turmush tarzidan ilhomlanib, ingredientlar, oziqlanish va kundalik oziqlantirishga e’tibor beradi. Har bir tanlov, har bir porsiya va birga o‘tgan har bir kunga uy hayvonlariga bo‘lgan mehrimizni singdiramiz.'),
'kk':dict(names=['Барлық жастағы мысықтарға · Тауық еті','Барлық жастағы мысықтарға · Сиыр еті','Марғауларға · Тауық еті','Барлық жастағы иттерге · Тауық еті','Барлық жастағы иттерге · Сиыр еті','Ұсақ тұқымды иттерге · Тауық еті','Ұсақ тұқымды иттерге · Сиыр еті'],ch='Тауық еті + сүйекті тауық еті',be='Сиыр еті + сүйекті сиыр еті',rest='жүгері глютені, жүгері, күріш, қызылша сығындысы, тауық майы.',ing='Құрамы',size='Таза салмағы',detail='Құрамы мен қаптамасы',enq='Өнім туралы сұрау',note='Жануар текті құрамдастардың үлесі ет пен сүйекті еттің жиынтық үлесін білдіреді. Азықтандыру нұсқаулығы мен толық ақпаратты қаптамадан қараңыз.',title='Табиғатқа жақын —<br>қамқорлықпен азықтандыру.',about='Үй жануарлары — отбасы. Әрбір асқа мұқият қарау керек.',body='PURE PAW табиғатқа жақын өмір салтынан шабыт алып, құрамдастарға, қоректенуге және күнделікті азықтандыруға көңіл бөледі. Жануарларға деген қамқорлығымызды әр таңдауымызға, әр азық үлесіне және бірге өткізген әр күнге арнаймыз.'),
'ar':dict(names=['أغذية القطط لجميع الأعمار · دجاج','أغذية القطط لجميع الأعمار · لحم بقر','أغذية القطط الصغيرة · دجاج','أغذية الكلاب لجميع الأعمار · دجاج','أغذية الكلاب لجميع الأعمار · لحم بقر','أغذية الكلاب صغيرة السلالة · دجاج','أغذية الكلاب صغيرة السلالة · لحم بقر'],ch='لحم دجاج + لحم دجاج بالعظم',be='لحم بقر + لحم بقر بالعظم',rest='مسحوق غلوتين الذرة، ذرة، أرز، لب البنجر، دهن الدجاج.',ing='المكونات',size='الوزن الصافي',detail='المكونات وأحجام العبوات',enq='استفسر عن هذا المنتج',note='تمثل نسبة المكونات الحيوانية مجموع اللحم واللحم بالعظم. راجع العبوة لإرشادات التغذية ومعلومات الملصق الكاملة.',title='أقرب إلى الطبيعة،<br>تغذية بعناية.',about='الحيوانات الأليفة من العائلة، وكل وجبة تستحق الاهتمام.',body='تستلهم PURE PAW من أسلوب حياة قريب من الطبيعة، مع الاهتمام بالمكونات والتغذية والإطعام اليومي. نضع رعايتنا للحيوانات الأليفة في كل اختيار وكل حصة طعام وكل يوم نقضيه معًا.'),
'ky':dict(names=['Бардык курактагы мышыктарга · Тоок эти','Бардык курактагы мышыктарга · Уй эти','Мышыктын балдарына · Тоок эти','Бардык курактагы иттерге · Тоок эти','Бардык курактагы иттерге · Уй эти','Майда тукумдагы иттерге · Тоок эти','Майда тукумдагы иттерге · Уй эти'],ch='Тоок эти + сөөктүү тоок эти',be='Уй эти + сөөктүү уй эти',rest='жүгөрү глютени, жүгөрү, күрүч, кызылча целлюлозасы, тоок майы.',ing='Курамы',size='Таза салмагы',detail='Курамы жана таңгак өлчөмү',enq='Өнүм жөнүндө суроо',note='Жаныбар тектүү чийки заттын үлүшү эт менен сөөктүү эттин жалпы үлүшүн билдирет. Тоюттандыруу көрсөтмөлөрүн жана толук маалыматты таңгактан караңыз.',title='Табиятка жакын —<br>камкордук менен азыктандыруу.',about='Үй жаныбарлары — үй-бүлө. Ар бир тамакка көңүл буруу зарыл.',body='PURE PAW табиятка жакын жашоо образынан шыктанып, курамга, азыктанууга жана күнүмдүк тоюттандырууга көңүл бурат. Жаныбарларга болгон камкордугубузду ар бир тандоого, ар бир порцияга жана бирге өткөргөн ар бир күнгө арнайбыз.'),
'tg':dict(names=['Барои гурбаҳои ҳама синну сол · Мурғ','Барои гурбаҳои ҳама синну сол · Гов','Барои гурбачаҳо · Мурғ','Барои сагҳои ҳама синну сол · Мурғ','Барои сагҳои ҳама синну сол · Гов','Барои сагҳои зоти хурд · Мурғ','Барои сагҳои зоти хурд · Гов'],ch='Гӯшти мурғ + гӯшти мурғи устухондор',be='Гӯшти гов + гӯшти гови устухондор',rest='глютени ҷуворимакка, ҷуворимакка, биринҷ, селлюлозаи лаблабу, равғани мурғ.',ing='Таркиб',size='Вазни холис',detail='Таркиб ва андозаи баста',enq='Дар бораи маҳсулот пурсед',note='Ҳиссаи ашёи ҳайвонотӣ маҷмӯи гӯшт ва гӯшти устухондорро ифода мекунад. Дастури ғизодиҳӣ ва маълумоти пурраро дар баста бинед.',title='Наздиктар ба табиат —<br>ғизо бо ғамхорӣ.',about='Ҳайвоноти хонагӣ аъзои оилаанд. Ҳар як хӯрок сазовори таваҷҷуҳ аст.',body='PURE PAW аз тарзи зиндагии наздик ба табиат илҳом гирифта, ба таркиб, ғизо ва ғизодиҳии ҳаррӯза диққат медиҳад. Мо ғамхорӣ ба ҳайвонотро ба ҳар интихоб, ҳар порсияи хӯрок ва ҳар рӯзи якҷоя мегузорем.')}

def panel(m):
    code=m.group(1); block=m.group(0); t=L[code]
    block=re.sub(r'<h1>.*?</h1>','<h1>'+t['title']+'</h1>',block,count=1,flags=re.S)
    block=re.sub(r'(<div class="intro">.*?<h2>).*?(</h2><p>).*?(</p>)',lambda x:x[1]+t['about']+x[2]+t['body']+x[3],block,count=1,flags=re.S)
    cards=[]
    for i,(prefix,sizes,pct,meat,kind) in enumerate(products):
        ingredients=(t['ch'] if meat=='chicken' else t['be'])+f' {pct}%, '+t['rest']
        packs=' / '.join(str(x)+' kg' for x in sizes)
        cards.append(f'<div class="card"><span class="num">{i+1:02}</span><h3>{t["names"][i]}</h3><p>{t["size"]}: {packs}</p><details><summary>{t["detail"]}</summary><p><strong>{t["ing"]}</strong><br>{ingredients}</p></details><p><a href="https://wa.me/998999876888">{t["enq"]} ↗</a></p></div>')
    block=re.sub(r'<div class="cards">.*?</div><p class="note">.*?</p>', '<div class="cards">'+''.join(cards)+'</div><p class="note">'+t['note']+'</p>',block,count=1,flags=re.S)
    block=block.replace('+998 99 987 68 88<br>','<a href="tel:+998958266999">+998 95 826 69 99</a><br>')
    block=block.replace('<p dir="ltr">','<p dir="ltr">PURE PAW NUTRITION MCHJ<br>Tashkent, Korasuv<br>')
    return block

updated=re.sub(r'<article class="panel panel-([a-z]+)".*?</article>',panel,old,flags=re.S)
updated=updated.replace('https://1307121.eu15.myftpupload.com/wp-content/uploads/','https://purepawfoods.com/wp-content/uploads/')
updated=updated.replace('grid-template-columns:repeat(4,1fr)','grid-template-columns:repeat(3,minmax(0,1fr))').replace('grid-template-columns:repeat(4,minmax(0,1fr))','grid-template-columns:repeat(3,minmax(0,1fr))')
updated=updated.replace('#pp .card{border:','#pp .card{overflow-wrap:anywhere;min-width:0;border:')
updated=updated.replace('#pp .cards{grid-template-columns:1fr 1fr}','#pp .cards{grid-template-columns:1fr}')
updated=updated.replace('</style>','#pp summary{cursor:pointer;font-weight:700;padding:10px 0}#pp details p{font-size:14px}#pp .card h3{font-size:20px}</style>')
assert updated.count('<details>')==56
assert 'Ranges in development' not in updated
assert 'Fish</p>' not in updated and 'Lamb ·' not in updated
(root/'PurePaw_网站更新_20261110.html').write_text(updated,encoding='utf-8')
note=root/'PurePaw_网站更新说明_20261110.md'
# 说明文档由人工持续维护（含发布状态），只允许首次生成，禁止覆盖已有版本
if not note.exists(): note.write_text('''# PurePaw 网站更新准备

状态：已完成本地待更新版本，尚未发布。

来源：C:/Users/yinho/Desktop/包装袋/狗 中19份最新Word，修改日期2026-11-03。

更新范围：八语品牌理念；7个产品系列、19个规格；七款配料完整原料称谓及比例；公司名称 PURE PAW NUTRITION MCHJ、地址 Tashkent, Korasuv、电话 +998 95 826 69 99。保留用户先前明确提供的 WhatsApp +998 99 987 68 88 及邮箱 farid.it.uz@gmail.com。

猫粮鸡肉、牛肉、幼猫鸡肉：1.5/3/10kg。全龄犬鸡肉、牛肉：1.5/5/15kg。小型犬鸡肉、牛肉：1.5/3kg。

移除旧研发目录中的鱼肉、羊肉产品与内部配方编号。动物原料比例按肉与带骨肉合计表达，不改写为纯肉或鲜肉比例。

暂不新增营养保证值及克数喂食表：原文仍存在干物质基础与水分同表、部分幼猫表结构和小型犬活动量口径疑点，已有核对记录详述。网站保留包装标签作为完整喂养信息来源。

待执行：登录并核对网站当前实际内容，保存后台原文备份，将差异合并到真实当前页面，发布后检查八语与联系方式。不得以旧本地备份覆盖此后用户的其他网站修改。
''',encoding='utf-8')
print(json.dumps({'languages':len(L),'product_families':len(products),'sizes':sum(len(p[1]) for p in products),'details':updated.count('<details>'),'bytes':len(updated.encode())},ensure_ascii=False))
