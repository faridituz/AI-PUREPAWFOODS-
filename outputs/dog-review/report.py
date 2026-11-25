from pathlib import Path
import json,re
b=Path(__file__).parent;d=json.loads((b/'texts.json').read_text(encoding='utf8'))
text='''# 修改后狗粮文案核对结果

范围：用户本次提供的10份Word。检查正文与表格内容，未修改原稿，未核对新PSD，也未完成逐页视觉排版检查。

结论：犬粮称谓大部分已修改，但10份均仍有乌兹别克语猫称谓残留和俄语换粮配比语法问题；5份牛肉稿还存在哈萨克语栏目混入塔吉克语的问题。未达到可直接定稿状态。

## 全部10份均需修改

1. 乌兹别克语喂食量表后的备注：mushukning（猫的）应改为itning（狗的）。句子其余部分可以保持。修订句：

Oziqlantirish miqdorlari faqat ma’lumot uchun; itning tana holati, faollik darajasi va ob-havo sharoitiga qarab mos ravishda o‘zgartiring.

2. 俄语换粮比例：25% корм для собак purepaw等写法中，百分比后应使用корма，不是独立产品名称使用的корм。建议四条统一为：

25% корма PURE PAW для собак

50% корма PURE PAW для собак

75% корма PURE PAW для собак

100% корма PURE PAW для собак

独立名称“Корм для собак”本身正确，不能全局把所有корм都替换成корма。俄语品牌官方的换粮配比也采用百分比后“корма”的形式：https://www.royalcanin.com/ua/ru-ua/about-us/faqs

## 五份牛肉稿均需修改

哈萨克语配料栏开头为“Гӯшти гов + гӯшти гов бо устухон48%”。这是塔吉克语内容，不是哈萨克语；后半段则是哈萨克语，形成混语。

可供语言校对确认的哈萨克语替换片段：Сиыр еті + сүйекті сиыр еті 48%

仅替换上述片段，保持后面的原配料列表及48%不变；48%具体指两者合计还是其中一项，需以配方原始定义为准。塔吉克语词形参考：https://www.izar.tj/sites/default/files/field/jurnal/farkhangi_tafsirii_zaboni_tochiki_childi_1_dushanbe_-_2018.pdf

## 个别拼写及空格错误

|文件|位置|原文|建议|
|---|---|---|---|
|全犬牛肉15-文字(2).docx|乌兹别克语第1—2天|25% ppurepaw itlar uchun ozuqa|25% PURE PAW itlar uchun ozuqa|
|全犬鸡肉5-文字(2).docx|英语第5—6天|75% purepawdog food|75% PURE PAW dog food|
|小犬牛肉3-文字(3).docx|哈萨克语第5—6天、第7天|purepawиттерге|PURE PAW иттерге|

多份稿件还存在25%purepaw、50%корм等百分号后缺空格、双空格等问题。统一为“百分比 + 单个空格 + 文案”；品牌统一为PURE PAW属于格式规范，不是所有小写形式都构成翻译错误。

## 需确认而不能直接改数值的内容

1. 全部四语磷指标均为≥0.9-1.1%，将下限符号与区间混写，需配方负责人确认是≥0.9%、0.9–1.1%或其他规格。
2. 全部喂食表末行均为45-75kg；与此前参考图45-70kg不同，需确认批准版本，不能自行认定75或70正确。
3. “小犬”文件与全犬文件使用相同的五档体重喂食表。如果小犬指小型犬，45-75kg等范围与定位不相称；如果指幼犬，现稿未体现幼犬阶段的喂食说明。需先确认“小犬”的商品定义。
4. 鸡肉稿俄语“костяное куриное мясо”、牛肉稿“костное говяжье мясо”表达生硬，与英语bone-in意图不够清楚。若原料确实为带骨肉，可由译审确认使用“куриное мясо на кости”“говядина на кости”；若实际为肉骨粉或其他原料，则不能如此替换。

## 已核对一致的项目

10份均未检出英语cat food及哈萨克语мысық残留；英语犬粮称谓已改为dog food（其中一处与品牌粘连）。每份内四语喂食表的五行体重及低高活动量数据一致。净重与文件规格一致；鸡肉比例四语均为40%，牛肉比例四语均为48%。这些是一致性结论，不代表营养适配性或法规验收。

## 逐文件问题清单

|文件|共通问题|其他问题|
|---|---|---|
'''
for n,ls in d.items():
 extra=[]
 if '牛肉' in n:extra.append('哈萨克语配料混入塔吉克语')
 if any('ppurepaw' in t for t in ls):extra.append('品牌多一个p')
 if any('purepawdog' in t for t in ls):extra.append('品牌与dog缺空格')
 if any('purepawиттерге' in t for t in ls):extra.append('品牌与哈萨克语缺空格')
 if any(re.search(r'%[^\s]',t) for t in ls if 'purepaw' in t):extra.append('百分号后缺空格')
 if '小犬' in n:extra.append('需确认小犬定义及喂食表适用性')
 text+=f'|{n}|mushukning未改；俄语百分比后корм应为корма|'+('；'.join(extra) or '未发现额外独有拼写问题')+'|\n'
text+='\n源文件目录：C:/Users/yinho/Desktop/包装袋/狗。全部原文件保持不变。\n'
(b/'修改后狗粮文案核对清单.md').write_text(text,encoding='utf8')
print('Report saved')
