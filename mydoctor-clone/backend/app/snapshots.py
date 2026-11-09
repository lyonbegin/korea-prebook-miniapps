"""Timestamped public *fact* snapshots for when original live requests return 403/429.
Provenance: https://my-doctor.io/ pages observed 2026-11-09.
These are NOT original HTML, licensed images, live prices or verified bookings.
"""
from html import escape
from urllib.parse import quote, urlsplit, parse_qs
OBSERVED_AT="2026-11-09"
DEPARTMENTS=["가정의학과","내과","비뇨기과(비뇨의학과)","산부인과","성형외과","소아과(소아청소년과)","소아치과","안과","외과","이비인후과","정신과(정신건강의학과)","정형외과","치과","피부과","구강내과","마취통증의학과","소화기내과","순환기내과","신경과","신장내과","알레르기내과","재활의학과","호흡기내과"]
COSTS=["마운자로","위고비","삭센다","에페","다이어트 경구약","탈모약","여드름약","독감예방접종","가다실9가","대상포진예방접종","치과","시력교정술","MRI검사","상급병실료","초음파 검사","예방접종-백신","제증명-수수료","정밀-검사","내시경-검사","MRA-검사","주사-치료","물리치료","정신과-상담-치료","처치-및-수술","모발-이식","한방","치료재료","드림렌즈","교육-상담"]

# First-party public destinations observed 2026-11-09 at /telemedicine/all-department.
# Names and slugs are source observations, not synthetic provider entries.
DEPARTMENT_ROUTES={
"가정의학과":"가정의학과-비대면진료-예약",
"내과":"내과-비대면진료-예약",
"비뇨기과(비뇨의학과)":"비뇨기과-비뇨의학과-비대면진료-예약",
"산부인과":"산부인과-비대면진료-예약",
"성형외과":"성형외과-비대면진료-예약",
"소아과(소아청소년과)":"소아과-소아청소년과-비대면진료-예약",
"소아치과":"소아치과-비대면진료-예약",
"안과":"안과-비대면진료-예약",
"외과":"외과-비대면진료-예약",
"이비인후과":"이비인후과-비대면진료-예약",
"정신과(정신건강의학과)":"정신과-정신건강의학과-비대면진료-예약",
"정형외과":"정형외과-비대면진료-예약",
"치과":"치과-비대면진료-예약",
"피부과":"피부과-비대면진료-예약",
"구강내과":"구강내과-비대면진료-예약",
"마취통증의학과":"마취통증의학과-비대면진료-예약",
"소화기내과":"소화기내과-비대면진료-예약",
"순환기내과":"순환기내과-비대면진료-예약",
"신경과":"신경과-비대면진료-예약",
"신장내과":"신장내과-비대면진료-예약",
"재활의학과":"재활의학과-비대면진료-예약",
"호흡기내과":"호흡기내과-비대면진료-예약",
}
# Source-verified symptom route slugs from the same publicly accessible index.
SYMPTOM_ROUTES=[
"비염","중이염","인후염","부비동염-축농증","편도염","이명","고막염","꽃가루-알레르기",
"코골이","난청","수면무호흡","인두염","후두염","당뇨병","동맥경화","만성피로",
"대사증후군","레이노병","전립선염","요실금","남성-갱년기","귀두포피염","과민성-방광",
"속쓰림","장염","위염","급체","소화불량","설사","식도염","노로바이러스","변비",
"두통","편두통","안면경련","안구건조증","결막염","다래끼","질염","생리통","생리불순"]

def page(title,body):
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+
       escape(title)+'</title></head><body><main><h1>'+escape(title)+'</h1>'+body+
       '</main></body></html>').encode('utf-8')
def links(rows):
    return "<section>"+''.join('<p><a href="'+escape(path)+'">'+escape(title)+'</a></p>' for title,path in rows)+"</section>"
MAIN=[
    ("비대면 진료","/telemedicine/all-department"),
    ("내 주변 병원 찾기","/hospital"),
    ("의료비 가격 비교","/medical-cost"),
    ("의약품 정보","/medicine"),
    ("건강연구소","/healthLab"),
    ("약국 찾기","/pharmacy")
]
def snapshot_for(path,query=""):
    if path=="/":
        return page("나만의닥터",'<h2>비대면 진료</h2><p>증상과 진료과를 선택하세요.</p>'+
                    links(MAIN)+'<h2>비급여 진료비</h2>'+links([(c,"/medical-cost/"+quote(c)) for c in COSTS]))
    if path=="/medical-cost":
        return page("의료비 가격 비교",'<p>비급여 진료비 항목을 비교해 보세요.</p>'+
                    links([(c,"/medical-cost/"+quote(c)) for c in COSTS]))
    if path=="/hospital":
        return page("근처 병원 찾기",'<p>지역별 진료과와 운영시간을 기준으로 병원 검색</p>'+
             links([("야간 진료","/hospital/"+quote("야간진료")),("일요일 진료","/hospital/"+quote("일요일진료")),
                    ("창원한마음병원","/hospital/detail?hospital_id=323")]))
    if path=="/telemedicine/all-department":
        return page("증상·진료과별 비대면 진료",
          '<h2>진료과</h2>'+links([(d,"/telemedicine/"+quote(slug)) for d,slug in DEPARTMENT_ROUTES.items()])+
          '<h2>전체 진료과</h2>'+'<ul>'+''.join('<li>'+escape(d)+'</li>' for d in DEPARTMENTS)+'</ul>')
    if path=="/hospital/detail" and parse_qs(query).get("hospital_id")==["323"]:
        table="""<h2>진료비 안내</h2><table>
          <thead><tr><th>진료 항목</th><th>진료비</th><th>비고</th><th>진료 방식</th><th>건강보험 적용</th></tr></thead>
          <tbody><tr><td>급여 진료 · 대면</td><td>5,600원</td><td>6~64세 기준</td><td>대면 진료</td><td>적용(급여)</td></tr>
          <tr><td>대상포진 예방접종</td><td>230,000원</td><td>1회 접종 기준</td><td>예방접종</td><td>미적용(비급여)</td></tr>
          <tr><td>독감 예방접종</td><td>40,000원</td><td>1회 접종 기준</td><td>예방접종</td><td>미적용(비급여)</td></tr></tbody></table>"""
        return page("창원한마음병원",'<p>경남 창원시 의창구 용동로57번길 8</p>'+table+
                    "<h2>진료시간</h2><p>월~일 24시간</p>")
    if path.startswith("/telemedicine/"):
        from urllib.parse import unquote
        slug=unquote(path[len("/telemedicine/"):])
        if slug in set(DEPARTMENT_ROUTES.values()) or slug in {s+"-비대면진료-예약" for s in SYMPTOM_ROUTES}:
            short=slug.removesuffix("-비대면진료-예약").replace("-"," ")
            return page(short+" 비대면 진료 예약",
              "<p>원본에서 공개한 비대면 진료 정보입니다. 의료진 예약과 실시간 가능 여부는 원본 서비스에서 확인하세요.</p>"+
              links([("원본 비대면 진료 정보","https://my-doctor.io/telemedicine/"+quote(slug))]))
    if path=="/medical-cost/"+quote("마운자로") or path=="/medical-cost/마운자로":
        return page("전국 마운자로 최저 가격 비교 지도(2026)",
          "<p>원본 공개 정보 2026-11-09 기준 · 2,567곳</p>"+
          "<h2>마운자로 약국 가격</h2><p>1팩 최저 269,000원 · 평균 304,060원</p>"+
          "<h2>마운자로 병원 처방비</h2><p>최저 5,000원 · 평균 21,070원</p>"+
          "<table><thead><tr><th>구분</th><th>1팩</th><th>2팩</th><th>3팩</th></tr></thead>"+
          "<tbody><tr><td>약국 최저가</td><td>269,000원</td><td>538,000원</td><td>807,000원</td></tr>"+
          "<tr><td>약국 평균가</td><td>304,060원</td><td>608,080원</td><td>912,110원</td></tr>"+
          "<tr><td>병원 최저 진료비</td><td>5,000원</td><td>5,000원</td><td>5,000원</td></tr>"+
          "<tr><td>병원 평균 진료비</td><td>21,070원</td><td>36,910원</td><td>53,700원</td></tr></tbody></table>")
    if path.startswith("/medical-cost/"):
        name=path.rsplit("/",1)[-1]
        from urllib.parse import unquote
        value=unquote(name)
        if value in COSTS:
            return page(value+" 의료비 가격 비교",'<p>원본 공개 자료의 상세 항목 가격은 실시간 검증이 필요합니다.</p>')
    return None
