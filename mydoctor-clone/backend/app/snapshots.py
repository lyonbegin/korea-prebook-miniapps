"""Timestamped public *fact* snapshots for when original live requests return 403/429.
Provenance: https://my-doctor.io/ pages observed 2026-11-09.
These are NOT original HTML, licensed images, live prices or verified bookings.
"""
from html import escape
from urllib.parse import quote, urlsplit, parse_qs
OBSERVED_AT="2026-11-09"
DEPARTMENTS=["가정의학과","내과","비뇨기과(비뇨의학과)","산부인과","성형외과","소아과(소아청소년과)","소아치과","안과","외과","이비인후과","정신과(정신건강의학과)","정형외과","치과","피부과","구강내과","마취통증의학과","소화기내과","순환기내과","신경과","신장내과","알레르기내과","재활의학과","호흡기내과"]
COSTS=["마운자로","위고비","삭센다","에페","다이어트 경구약","탈모약","여드름약","치과","시력교정술","MRI검사","상급병실료","초음파 검사","예방접종-백신","제증명-수수료","정밀-검사","내시경-검사","MRA-검사","주사-치료","물리치료","정신과-상담-치료","처치-및-수술","모발-이식","한방","치료재료","드림렌즈","교육-상담"]
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
        linkable={"이비인후과","정형외과","내과","피부과","안과","치과","외과","성형외과","재활의학과"}
        return page("증상·진료과별 비대면 진료",
          '<h2>진료과</h2>'+links([(d,"/telemedicine/"+quote(d+"-비대면진료-예약")) for d in DEPARTMENTS if d in linkable])+
          '<h2>전체 진료과</h2>'+'<ul>'+''.join('<li>'+escape(d)+'</li>' for d in DEPARTMENTS)+'</ul>')
    if path=="/hospital/detail" and parse_qs(query).get("hospital_id")==["323"]:
        table="""<h2>진료비 안내</h2><table>
          <thead><tr><th>진료 항목</th><th>진료비</th><th>비고</th><th>진료 방식</th><th>건강보험 적용</th></tr></thead>
          <tbody><tr><td>급여 진료 · 대면</td><td>5,600원</td><td>6~64세 기준</td><td>대면 진료</td><td>적용(급여)</td></tr>
          <tr><td>대상포진 예방접종</td><td>230,000원</td><td>1회 접종 기준</td><td>예방접종</td><td>미적용(비급여)</td></tr>
          <tr><td>독감 예방접종</td><td>40,000원</td><td>1회 접종 기준</td><td>예방접종</td><td>미적용(비급여)</td></tr></tbody></table>"""
        return page("창원한마음병원",'<p>경남 창원시 의창구 용동로57번길 8</p>'+table+
                    "<h2>진료시간</h2><p>월~일 24시간</p>")
    if path.startswith("/medical-cost/"):
        name=path.rsplit("/",1)[-1]
        from urllib.parse import unquote
        value=unquote(name)
        if value in COSTS:
            return page(value+" 의료비 가격 비교",'<p>원본 공개 자료의 상세 항목 가격은 실시간 검증이 필요합니다.</p>')
    return None
