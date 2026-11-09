package com.ifarmer.survey.repository;

import com.ifarmer.survey.model.entity.VersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VersionRepository extends JpaRepository<VersionEntity, String> {

    List<VersionEntity> findByProjectIdOrderByCreatedAtDesc(String projectId);

    Optional<VersionEntity> findByIdAndProjectId(String id, String projectId);

    @Modifying
    @Query("UPDATE VersionEntity v SET v.status = 'archived' WHERE v.projectId = :projectId AND v.status = 'published'")
    void archivePublishedVersions(@Param("projectId") String projectId);
}

