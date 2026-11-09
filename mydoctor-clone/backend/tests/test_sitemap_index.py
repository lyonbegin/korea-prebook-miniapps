import unittest
from app.sitemap_index import extract_locs,section_of,template_of,BASE

class SitemapUnitTests(unittest.TestCase):
    def test_index_and_urlset(self):
        xml=b'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://my-doctor.io/sitemaps/medicine/medicine.xml</loc></sitemap></sitemapindex>'
        self.assertEqual(extract_locs(xml,"sitemapindex"),["https://my-doctor.io/sitemaps/medicine/medicine.xml"])
        xml2=b'<urlset><url><loc>https://my-doctor.io/hospital/detail?hospital_id=323</loc></url><url><loc>https://my-doctor.io/hospital/detail?hospital_id=323</loc></url></urlset>'
        self.assertEqual(len(extract_locs(xml2,"urlset")),1)
    def test_host_rejection(self):
        xml=b'<urlset><url><loc>https://unknown.test/patient</loc></url></urlset>'
        with self.assertRaises(ValueError):extract_locs(xml,"urlset")
    def test_section_names(self):
        self.assertEqual(section_of(BASE+"/hospital/detail?hospital_id=323"),"hospital-detail")
        self.assertEqual(section_of(BASE+"/telemedicine/doctor/known-id"),"doctor")
        self.assertEqual(section_of(BASE+"/medical-cost/마운자로"),"medical-cost")
    def test_representative_template_deduplication(self):
        cases=[
          ("/hospital/detail?hospital_id=323","/hospital/detail?hospital_id=62360","hospital-detail"),
          ("/medical-cost/마운자로-서울","/medical-cost/위고비-부산","medical-cost-category"),
          ("/dept-hub/가정의학과/강원","/dept-hub/내과/서울","hospital-by-department"),
          ("/medicine/중외-5-포도당주사액-195500006","/medicine/올로스틴정-5mg-200805124","medicine-detail"),
          ("/healthLab/info/1268/만성-소화기-질환-관리법","/healthLab/FAQ/1058/질문","health-article-or-test")
        ]
        for a,b,expected in cases:
            self.assertEqual(template_of(BASE+a),expected)
            self.assertEqual(template_of(BASE+b),expected)
    def test_unique_behaviors_keep_separate_types(self):
        self.assertNotEqual(template_of(BASE+"/hospital"),
                            template_of(BASE+"/hospital/detail?hospital_id=323"))
        self.assertNotEqual(template_of(BASE+"/medical-cost"),
                            template_of(BASE+"/medical-cost/마운자로"))
        self.assertNotEqual(template_of(BASE+"/telemedicine/all-department"),
                            template_of(BASE+"/telemedicine/비염-비대면진료-예약"))
if __name__=="__main__":unittest.main()
