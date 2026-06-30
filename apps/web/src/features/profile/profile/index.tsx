// Components Imports

// Data Imports
import { db } from "@/features/profile/data";
import AboutSection from "@/features/profile/profile/about-section";
import { ActivityTimeline } from "@/features/profile/profile/activity-timeline";
import Connections from "@/features/profile/profile/connections";
import ProfileProjectDatatable from "@/features/profile/profile/profile-project-datatable";
import Teams from "@/features/profile/profile/teams";

const { activityLog } = db;

function Profile() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* About Section */}
      <div className="col-span-12 space-y-6 lg:col-span-4">
        <AboutSection />
      </div>

      {/* Activity Section */}
      <div className="col-span-12 lg:col-span-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Activity timeline */}
          <ActivityTimeline activityLog={activityLog} className="col-span-12" />
          {/* Connections */}
          <Connections className="col-span-12 lg:col-span-6" />
          {/* Teams */}
          <Teams className="col-span-12 lg:col-span-6" />
          {/* Projects DataTable */}
          <ProfileProjectDatatable className="col-span-12" />
        </div>
      </div>
    </div>
  );
}

export default Profile;
